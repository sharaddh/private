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
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";

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
  advanceQuantity: z.number().optional(),
});

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
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
}));

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const order = new Order(p as any);
    await order.save();
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id).populate("customerId", "name mobile");
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: o });
}));

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
    res.json({ success: true, data: o });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /:id/classify — set classification
router.patch("/:id/classify", authenticate, asyncHandler(async (req, res) => {
  const { classification } = req.body;
  if (!["pending", "stock", "buy", "order"].includes(classification)) {
    return res.status(400).json({ success: false, message: "Invalid classification" });
  }
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: { classification } }, { new: true });
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: o });
}));

// PATCH /:id/review — toggle reviewed flag
router.patch("/:id/review", authenticate, asyncHandler(async (req, res) => {
  const o = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: { reviewed: req.body.reviewed } },
    { new: true }
  );
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: o });
}));

// PATCH /:id/status — validated status transition with partial advancement support
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status, collectPayment, paymentMode, advanceQuantity } = statusUpdateSchema.parse(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    const qty = order.quantity || 1;
    const advQty = advanceQuantity ?? qty;
    const currentForwarded = order.forwardedCount || 0;
    const newForwarded = currentForwarded + advQty;

    if (newForwarded >= qty) {
      order.status = status as any;
      order.forwardedCount = 0;
    } else {
      order.forwardedCount = newForwarded;
    }
    await order.save();

    const result: any = { order, partial: newForwarded < qty, forwardedCount: newForwarded < qty ? newForwarded : 0 };

    // Auto-update delivery (only on full transition)
    const delivery = await Delivery.findOne({ orderId: order._id });
    if (delivery && newForwarded >= qty) {
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

    // Auto-send WhatsApp when Ready for pickup (full transition only)
    if (status === "Ready" && newForwarded >= qty) {
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

    // Auto-send WhatsApp when Delivered (full transition only)
    if (status === "Delivered" && newForwarded >= qty) {
      const customer = await Customer.findById(order.customerId).select("name mobile");
      if (customer?.mobile) {
        const settings = await Settings.findOne().sort({ createdAt: -1 });
        const shop = settings?.shopName || "KMJ Optical";
        const msg = `*${shop}* 🕶\n\nHi ${customer.name},\nYour order has been delivered! 🎉\n\nThank you for choosing ${shop}.\nSee you again! 🙏`;
        const sent = await whatsapp.sendMessage(normalizePhone(customer.mobile), msg);
        if (!sent) console.log(`WhatsApp: order delivered message queued for ${customer.mobile}`);
      }
    }

    // Handle due collection on delivery (full transition only)
    if (status === "Delivered" && newForwarded >= qty && collectPayment && collectPayment > 0) {
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
  const a = axis != null ? `x${axis}` : "";
  if (!s && !c) return "-";
  return `${s}${c ? ` / ${c}` : ""}${a ? ` ${a}` : ""}`;
}

function generateDemandPdf(orders: any[], type: "buy" | "order"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A4", margin: 20 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pw = doc.page.width;
    const m = 20;
    const cw = pw - 2 * m;
    let y = m;

    const title = type === "buy" ? "PURCHASE LIST" : "LAB ORDER LIST";
    const label = type === "buy" ? "Items to Purchase" : "Items to Order from Lab";

    doc.rect(0, 0, pw, 22).fillColor("#4f46e5").fill();
    doc.fontSize(16).font("Helvetica-Bold").fillColor("white");
    doc.text(title, pw / 2, 14, { align: "center" });

    y = 36;

    doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, m, y);
    doc.text(`Total Items: ${orders.length}`, m + 200, y);
    y += 16;

    orders.forEach((o, idx) => {
      const cName = o.customerId?.name || "—";
      const cMobile = o.customerId?.mobile || "";
      const rx = o.prescription;
      const lensLabel = [o.lensBrand, o.lensType, o.lensIndex].filter(Boolean).join(" ") || "";
      const coating = o.coating || "";
      const qty = o.quantity || 1;

      // Card header
      doc.rect(m, y, cw, 16).fillColor("#f1f5f9").fill();
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(`#${idx + 1}  ${cName}  ${cMobile}`, m + 6, y + 4);
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280");
      doc.text(`Qty: ${qty}`, m + cw - 40, y + 4);
      y += 16;

      // Items in two columns
      const leftX = m + 6;
      const rightX = m + cw / 2 + 6;
      let col = leftX;
      let itemY = y;

      if (o.frameBrand) {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#4f46e5");
        doc.text("Frame:", col, itemY);
        doc.font("Helvetica").fillColor("#374151");
        doc.text(`${o.frameBrand}${o.frameModel ? ` (${o.frameModel})` : ""}${o.frameColor ? ` - ${o.frameColor}` : ""}`, col + 38, itemY);
        itemY += 10;
      }

      if (lensLabel || coating) {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#0891b2");
        doc.text("Lens:", col, itemY);
        doc.font("Helvetica").fillColor("#374151");
        doc.text(`${lensLabel}${coating ? ` | Coating: ${coating}` : ""}`, col + 30, itemY);
        itemY += 10;
      }

      if (o.accessories?.length) {
        doc.fontSize(7).font("Helvetica").fillColor("#6b7280");
        doc.text(`Acc: ${o.accessories.join(", ")}`, col, itemY);
        itemY += 9;
      }

      // Prescription on right column
      const rDV = rx?.rightEye?.dv;
      const lDV = rx?.leftEye?.dv;
      const rNV = rx?.rightEye?.nv;
      const lNV = rx?.leftEye?.nv;

      if (rDV?.sph != null || lDV?.sph != null || rNV?.sph != null || lNV?.sph != null) {
        let rxY = y;
        doc.fontSize(7).font("Courier-Bold").fillColor("#374151");
        doc.text("RX", rightX, rxY);
        rxY += 9;
        doc.font("Courier").fillColor("#374151");

        const sameRx =
          (rDV?.sph === lDV?.sph && rDV?.cyl === lDV?.cyl && rDV?.axis === lDV?.axis) &&
          (rNV?.sph === lNV?.sph && rNV?.cyl === lNV?.cyl && rNV?.axis === lNV?.axis);

        if (sameRx) {
          const dv = formatDemandRx(rDV?.sph || lDV?.sph, rDV?.cyl || lDV?.cyl, rDV?.axis || lDV?.axis);
          const add = (rDV?.sph != null && rNV?.sph != null) ? (rNV.sph - rDV.sph).toFixed(2) : null;
          doc.text(`${dv}${add ? `  ADD ${add}` : ""}  PD: ${rx?.pd || "—"}`, rightX, rxY);
          rxY += 9;
        } else {
          if (rDV?.sph != null) {
            const rDv = formatDemandRx(rDV.sph, rDV.cyl, rDV.axis);
            const addR = (rNV?.sph != null) ? (rNV.sph - rDV.sph).toFixed(2) : null;
            doc.text(`R: ${rDv}${addR ? `  ADD ${addR}` : ""}`, rightX, rxY);
            rxY += 9;
          }
          if (lDV?.sph != null) {
            const lDv = formatDemandRx(lDV.sph, lDV.cyl, lDV.axis);
            const addL = (lNV?.sph != null) ? (lNV.sph - lDV.sph).toFixed(2) : null;
            doc.text(`L: ${lDv}${addL ? `  ADD ${addL}` : ""}`, rightX, rxY);
            rxY += 9;
          }
          if (rx?.pd) {
            doc.text(`PD: ${rx.pd}`, rightX, rxY);
            rxY += 9;
          }
        }

        if (rNV?.sph != null || lNV?.sph != null) {
          if (sameRx) {
            doc.text(`NV: ${formatDemandRx(rNV?.sph || lNV?.sph, rNV?.cyl || lNV?.cyl, rNV?.axis || lNV?.axis)}`, rightX, rxY);
          } else {
            doc.text(`R NV: ${rNV?.sph != null ? formatDemandRx(rNV.sph, rNV.cyl, rNV.axis) : "—"}  L NV: ${lNV?.sph != null ? formatDemandRx(lNV.sph, lNV.cyl, lNV.axis) : "—"}`, rightX, rxY);
          }
          rxY += 9;
        }

        itemY = Math.max(itemY, rxY);
      }

      y = Math.max(itemY, y + 30) + 6;

      if (y > 270) {
        doc.addPage();
        y = m;
      }
    });

    // Footer
    if (y < 270) {
      doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(m, 275).lineTo(pw - m, 275).stroke();
      doc.fontSize(8).font("Helvetica").fillColor("#9ca3af");
      doc.text(`Generated by KMJ Optical ERP  |  ${title}`, pw / 2, 283, { align: "center" });
    }

    doc.end();
  });
}

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
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
    const visitIds = orders.map(o => {
      const vid = (o.visitId as any)?._id || o.visitId;
      return vid ? vid.toString() : null;
    }).filter(Boolean);
    const prescriptions = visitIds.length > 0
      ? await Prescription.find({ visitId: { $in: visitIds } }).lean()
      : [];
    const rxMap = new Map(prescriptions.map(p => [p.visitId!.toString(), p]));
    const enriched = orders.map(o => {
      const vid = ((o.visitId as any)?._id || o.visitId)?.toString();
      return { ...o, prescription: vid ? rxMap.get(vid) || null : null };
    });

    const pdfBuffer = await generateDemandPdf(enriched, type);
    const title = type === "buy" ? "PURCHASE LIST" : "LAB ORDER LIST";
    const filename = type === "buy" ? "Purchase_List.pdf" : "Lab_Order_List.pdf";
    const caption = type === "buy"
      ? "Purchase List - Items to buy from supplier"
      : "Lab Order List - Items to order from lab";

    // Send to shop owner
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    let phone = settings?.shopPhone?.replace(/\D/g, "");
    if (!phone) {
      return res.status(400).json({ success: false, message: "Shop phone not configured" });
    }
    phone = phone.replace(/^0+/, "");
    const normalized = phone.length === 10 ? `91${phone}` : phone;
    const waStatus = await whatsapp.getStatus();

    const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
    console.log(`Demand PDF: ${filename}, ${sizeKB}KB, sending to ${normalized}, WA status: ${waStatus.status}`);

    const base64 = pdfBuffer.toString("base64");
    let sent = false;
    let sendError: string | null = null;

    try {
      sent = await whatsapp.sendMedia(normalized, base64, filename, caption, true);
    } catch (e: any) {
      sendError = e.message;
      console.error(`Demand PDF sendMedia threw: ${e.message}`);
    }

    // Fallback: if media send failed but WA is connected, send as text
    if (!sent && waStatus.status === "connected" && !sendError) {
      console.log("Demand PDF sendMedia returned false, trying text fallback");
      try {
        const items = enriched.map((o: any) => {
          const cName = o.customerId?.name || "—";
          const rx = o.prescription;
          const r = rx?.rightEye?.dv;
          const l = rx?.leftEye?.dv;
          const rxStr = r?.sph != null
            ? `R: ${r.sph}/${r.cyl || 0}x${r.axis || 0}  L: ${l?.sph || 0}/${l?.cyl || 0}x${l?.axis || 0}`
            : "No Rx";
          return `${cName} - ${o.frameBrand || ""} ${o.lensBrand || ""} | ${rxStr}`;
        }).join("\n");
        const textMsg = `${title}\n\n${items}\n\nTotal: ${enriched.length} items`;
        await whatsapp.sendMessage(normalized, textMsg);
      } catch (e2: any) {
        console.error(`Demand text fallback also failed: ${e2.message}`);
      }
    }

    const responseData = {
      sent,
      queued: !sent && waStatus.status !== "connected",
      waConnected: waStatus.status === "connected",
      phone: normalized,
      filename,
      count: enriched.length,
      sizeKB: parseFloat(sizeKB),
      sendError,
    };
    console.log("Demand PDF response:", JSON.stringify(responseData));
    res.json({ success: true, data: responseData });
  } catch (err: any) {
    console.error("Demand send error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
