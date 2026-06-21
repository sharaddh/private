import { Router } from "express";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Delivery } from "../models/delivery";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Settings } from "../models/settings";
import { Prescription } from "../models/prescription";
import { whatsapp } from "../services/whatsapp";
import PDFKit from "pdfkit";
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
  const { customerId, startDate, endDate } = req.query;
  const filter: any = {};
  if (customerId) filter.customerId = customerId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const s = new Date(startDate as string);
      s.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = e;
    }
  }
  const list = await Order.find(filter)
    .populate("customerId", "name mobile")
    .sort({ createdAt: -1 })
    .limit(500);

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

// PATCH /:id/classify — set classification
router.patch("/:id/classify", authenticate, async (req, res) => {
  const { classification } = req.body;
  if (!["pending", "stock", "buy", "order"].includes(classification)) {
    return res.status(400).json({ success: false, message: "Invalid classification" });
  }
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: { classification } }, { new: true });
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: o });
});

// PATCH /:id/review — toggle reviewed flag
router.patch("/:id/review", authenticate, async (req, res) => {
  const o = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: { reviewed: req.body.reviewed } },
    { new: true }
  );
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: o });
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

    function normalizePhone(phone: string): string {
      const digits = phone.replace(/\D/g, "");
      return digits.length === 10 ? `91${digits}` : digits;
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
        const sent = await whatsapp.sendMessage(normalizePhone(customer.mobile), msg);
        if (!sent) console.log(`WhatsApp: order ready message queued for ${customer.mobile}`);
      }
    }

    // Auto-send WhatsApp when Delivered
    if (status === "Delivered") {
      const customer = await Customer.findById(order.customerId).select("name mobile");
      if (customer?.mobile) {
        const settings = await Settings.findOne().sort({ createdAt: -1 });
        const shop = settings?.shopName || "KMJ Optical";
        const msg = `*${shop}* 🕶\n\nHi ${customer.name},\nYour order has been delivered! 🎉\n\nThank you for choosing ${shop}.\nSee you again! 🙏`;
        const sent = await whatsapp.sendMessage(normalizePhone(customer.mobile), msg);
        if (!sent) console.log(`WhatsApp: order delivered message queued for ${customer.mobile}`);
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

function formatDemandRx(sph?: number, cyl?: number, axis?: number): string {
  const s = sph != null ? (sph > 0 ? `+${sph}` : `${sph}`) : "";
  const c = cyl != null ? (cyl > 0 ? `+${cyl}` : `${cyl}`) : "";
  const a = axis != null ? `×${axis}` : "";
  if (!s && !c) return "—";
  return `${s}${c ? ` / ${c}` : ""}${a ? ` ${a}` : ""}`;
}

function generateDemandPdf(orders: any[], type: "buy" | "order"): Buffer {
  const doc = new PDFKit({ size: "A4", margin: 20 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const pw = doc.page.width;
  const m = 20;
  let y = m;

  const title = type === "buy" ? "PURCHASE LIST" : "LAB ORDER LIST";
  const label = type === "buy" ? "Items to Purchase" : "Items to Order from Lab";

  // Header
  doc.rect(0, 0, pw, 22).fillColor("#4f46e5").fill();
  doc.fontSize(16).font("Helvetica-Bold").fillColor("white");
  doc.text(title, pw / 2, 14, { align: "center" });

  y = 36;

  doc.fontSize(10).font("Helvetica").fillColor("#6b7280");
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, m, y);
  doc.text(`Total Items: ${orders.length}`, m + 200, y);
  y += 18;

  orders.forEach((o, idx) => {
    const cName = o.customerId?.name || "—";
    const cMobile = o.customerId?.mobile || "";
    const rx = o.prescription;
    const lensLabel = [o.lensBrand, o.lensType, o.lensIndex].filter(Boolean).join(" ") || "";
    const coating = o.coating || "";

    // Card header
    const cardTop = y;
    doc.rect(m, y, pw - 2 * m, 14).fillColor("#f1f5f9").fill();
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e293b");
    doc.text(`#${idx + 1}  ${cName}  ${cMobile}`, m + 6, y + 4);
    y += 14;

    // Frame info
    if (o.frameBrand) {
      doc.fontSize(8).font("Helvetica").fillColor("#4f46e5");
      doc.text(`Frame: ${o.frameBrand}${o.frameModel ? ` (${o.frameModel})` : ""}${o.frameColor ? ` - ${o.frameColor}` : ""}`, m + 10, y + 2);
      y += 10;
    }

    // Lens info
    if (lensLabel || coating) {
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#0891b2");
      doc.text(`Lens: ${lensLabel}${coating ? ` | Coating: ${coating}` : ""}`, m + 10, y + 2);
      y += 10;
    }

    // Prescription
    const rDV = rx?.rightEye?.dv;
    const lDV = rx?.leftEye?.dv;
    const rNV = rx?.rightEye?.nv;
    const lNV = rx?.leftEye?.nv;

    if (rDV?.sph != null || lDV?.sph != null || rNV?.sph != null || lNV?.sph != null) {
      doc.fontSize(8).font("Courier").fillColor("#374151");

      const sameRx =
        (rDV?.sph === lDV?.sph && rDV?.cyl === lDV?.cyl && rDV?.axis === lDV?.axis) &&
        (rNV?.sph === lNV?.sph && rNV?.cyl === lNV?.cyl && rNV?.axis === lNV?.axis);

      if (sameRx) {
        const dv = formatDemandRx(rDV?.sph || lDV?.sph, rDV?.cyl || lDV?.cyl, rDV?.axis || lDV?.axis);
        const add = (rDV?.sph != null && rNV?.sph != null) ? (rNV.sph - rDV.sph).toFixed(2) : null;
        doc.text(`Rx: ${dv}${add ? `  Add ${add}` : ""}  PD: ${rx?.pd || "—"}`, m + 14, y + 2);
        y += 10;
      } else {
        if (rDV?.sph != null) {
          const rDv = formatDemandRx(rDV.sph, rDV.cyl, rDV.axis);
          const addR = (rNV?.sph != null) ? (rNV.sph - rDV.sph).toFixed(2) : null;
          doc.text(`R: ${rDv}${addR ? `  Add ${addR}` : ""}`, m + 14, y + 2);
          y += 9;
        }
        if (lDV?.sph != null) {
          const lDv = formatDemandRx(lDV.sph, lDV.cyl, lDV.axis);
          const addL = (lNV?.sph != null) ? (lNV.sph - lDV.sph).toFixed(2) : null;
          doc.text(`L: ${lDv}${addL ? `  Add ${addL}` : ""}`, m + 14, y + 2);
          y += 9;
        }
        if (rx?.pd) {
          doc.text(`PD: ${rx.pd}`, m + 14, y + 2);
          y += 9;
        }
      }

      // NV line if different from DV
      if (rNV?.sph != null || lNV?.sph != null) {
        const showNv = sameRx
          ? `NV: ${formatDemandRx(rNV?.sph || lNV?.sph, rNV?.cyl || lNV?.cyl, rNV?.axis || lNV?.axis)}`
          : `R NV: ${rNV?.sph != null ? formatDemandRx(rNV.sph, rNV.cyl, rNV.axis) : "—"}  |  L NV: ${lNV?.sph != null ? formatDemandRx(lNV.sph, lNV.cyl, lNV.axis) : "—"}`;
        doc.text(showNv, m + 14, y + 2);
        y += 9;
      }

      y += 2;
    }

    // Spacer
    y += 4;

    // Page break check
    if (y > 260) {
      doc.addPage();
      y = m;
    }
  });

  // Footer
  if (y < 260) {
    doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(m, 270).lineTo(pw - m, 270).stroke();
    doc.fontSize(8).font("Helvetica").fillColor("#9ca3af");
    doc.text(`Generated by KMJ Optical ERP  |  ${title}`, pw / 2, 278, { align: "center" });
  }

  doc.end();
  return Buffer.concat(buffers);
}

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /demand-send — generate demand PDF and send via WhatsApp
router.post("/demand-send", authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    if (!["buy", "order"].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be "buy" or "order"' });
    }

    const orders = await Order.find({ classification: type })
      .populate("customerId", "name mobile")
      .populate("visitId")
      .sort({ createdAt: -1 })
      .lean();

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: `No ${type} items found` });
    }

    // Attach prescriptions
    const visitIds = orders.map(o => (o.visitId as any)?._id || o.visitId).filter(Boolean);
    const prescriptions = visitIds.length > 0
      ? await Prescription.find({ visitId: { $in: visitIds } }).lean()
      : [];
    const rxMap = new Map(prescriptions.map(p => [p.visitId!.toString(), p]));
    const enriched = orders.map(o => ({
      ...o,
      prescription: o.visitId ? rxMap.get(o.visitId.toString()) || null : null,
    }));

    const pdfBuffer = generateDemandPdf(enriched, type);
    const filename = type === "buy" ? "Purchase_List.pdf" : "Lab_Order_List.pdf";
    const caption = type === "buy"
      ? "📋 *Purchase List* — Items to buy from supplier"
      : "🔬 *Lab Order List* — Items to order from lab";

    // Send to shop owner
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    const phone = settings?.shopPhone?.replace(/\D/g, "");
    if (!phone) {
      return res.status(400).json({ success: false, message: "Shop phone not configured" });
    }
    const normalized = phone.length === 10 ? `91${phone}` : phone;
    const sent = await whatsapp.sendMedia(normalized, pdfBuffer.toString("base64"), filename, caption);

    res.json({
      success: true,
      data: { sent, queued: !sent, phone: normalized, filename, count: enriched.length },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
