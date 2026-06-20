import { Router } from "express";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Delivery } from "../models/delivery";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Settings } from "../models/settings";
import { whatsapp } from "../services/whatsapp";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Ordered", "Cancelled"],
  Ordered: ["In Lab", "Cancelled"],
  "In Lab": ["Ready", "Cancelled"],
  Ready: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  lens: z.string().optional(),
  coating: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: z.string(),
  collectPayment: z.number().optional(),
  paymentMode: z.string().optional(),
});

router.get("/", authenticate, async (req, res) => {
  const { customerId } = req.query;
  const filter: any = {};
  if (customerId) filter.customerId = customerId;
  const list = await Order.find(filter)
    .populate("customerId", "name mobile")
    .sort({ createdAt: -1 })
    .limit(100);

  // Attach pending bill amount per order
  const enriched = await Promise.all(
    list.map(async (o) => {
      const custId = (o.customerId as any)?._id || o.customerId;
      const bill = custId
        ? await Bill.findOne({ customerId: custId }).sort({ createdAt: -1 }).select("pendingAmount totalAmount advancePaid billNumber")
        : null;
      return { ...o.toObject(), billInfo: bill || null };
    })
  );

  res.json({ success: true, data: enriched });
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const order = new Order(p as any);
    await order.save();
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  const o = await Order.findById(req.params.id).populate("customerId", "name mobile");
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: o });
});

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: o });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /:id/status — validated status transition with optional due collection
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status, collectPayment, paymentMode } = statusUpdateSchema.parse(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    order.status = status as any;
    await order.save();

    const result: any = { order };

    // Auto-update delivery
    const delivery = await Delivery.findOne({ orderId: order._id });
    if (delivery) {
      if (status === "Ready") {
        delivery.status = "Ready";
        await delivery.save();
      } else if (status === "Delivered") {
        delivery.status = "Delivered";
        delivery.actualDeliveryDate = new Date();
        await delivery.save();
      } else if (status === "Cancelled") {
        delivery.status = "Cancelled";
        await delivery.save();
      }
      result.delivery = delivery;
    }

    // Auto-send WhatsApp when Ready for pickup
    if (status === "Ready") {
      const customer = await Customer.findById(order.customerId).select("name mobile");
      if (customer?.mobile) {
        const settings = await Settings.findOne().sort({ createdAt: -1 });
        const shop = settings?.shopName || "KMJ Optical";
        const items = [order.frame, order.lens, order.coating].filter(Boolean).join(", ");
        const deliveryDate = order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString("en-IN")
          : "soon";
        const msg = `*${shop}* 🕶\n\nHi ${customer.name},\nYour order is ready for pickup! 🎉\n\n${items ? `Items: ${items}\n` : ""}Delivery Date: ${deliveryDate}\n\nPlease visit the store to collect your order.\nThank you! 🙏`;
        try {
          await whatsapp.sendMessage(customer.mobile, msg);
        } catch { /* WhatsApp not connected, skip */ }
      }
    }

    // Handle due collection on delivery
    if (status === "Delivered" && collectPayment && collectPayment > 0) {
      const bill = await Bill.findOne({ customerId: order.customerId })
        .sort({ createdAt: -1 });
      if (bill && bill.pendingAmount > 0) {
        const payment = new Payment({
          customerId: order.customerId,
          billId: bill._id,
          amount: collectPayment,
          paymentMode: paymentMode || "Cash",
          paymentDate: new Date(),
          notes: `Collected on delivery (order ${order._id})`,
        });
        await payment.save();
        bill.advancePaid = (bill.advancePaid || 0) + collectPayment;
        bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
        await bill.save();
        result.payment = payment;
        result.bill = bill;

        const customer = await Customer.findById(order.customerId);
        if (customer) {
          customer.pendingAmount = Math.max(0, (customer.pendingAmount || 0) - collectPayment);
          await customer.save();
        }
      }
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
