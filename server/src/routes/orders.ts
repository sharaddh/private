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
import { AppError } from "../middleware/errorHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { normalizePhone } from "../utils/phone";

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

const updateSchema = z.object({
  customerId: z.string().optional(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  lens: z.string().optional(),
  coating: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional(),
  classification: z.string().optional(),
  rightLensStatus: z.string().optional(),
  leftLensStatus: z.string().optional(),
  reviewed: z.boolean().optional(),
  forwardedCount: z.number().optional(),
});

const statusUpdateSchema = z.object({
  status: z.string(),
  collectPayment: z.number().optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer"]).optional(),
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

router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const customer = await Customer.findById(p.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");
  const order = new Order(p as any);
  await order.save();
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: order });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id).populate("customerId", "name mobile");
  if (!o) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: o });
}));

router.put("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const validated = updateSchema.parse(req.body);
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: validated }, { new: true });
  if (!o) return res.status(404).json({ success: false, message: "Order not found" });
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: o });
}));

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

// PATCH /:id/classify-eye — per-eye lens classification
router.patch("/:id/classify-eye", authenticate, asyncHandler(async (req, res) => {
  const { eye, status } = req.body;
  if (!["right", "left"].includes(eye)) return res.status(400).json({ success: false, message: 'eye must be "right" or "left"' });
  if (!["pending", "stock", "buy", "order"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
  const field = eye === "right" ? "rightLensStatus" : "leftLensStatus";
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: { [field]: status } }, { new: true });
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
        if (!sent) console.log(`WhatsApp: order ready message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
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
        if (!sent) console.log(`WhatsApp: order delivered message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
      }
    }

    // Handle due collection on delivery (full transition only)
    if (status === "Delivered" && newForwarded >= qty && collectPayment && collectPayment > 0) {
      let bill = await Bill.findOne({ visitId: order.visitId || order._id });
      if (!bill) {
        bill = await Bill.findOne({ customerId: order.customerId }).sort({ createdAt: -1 });
      }
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

        await Customer.findByIdAndUpdate(order.customerId, {
          $inc: { pendingAmount: -collectPayment },
        });
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

interface DemandEntry {
  eye: string;
  customerName: string;
  lensLabel: string;
  coating: string;
  rxStr: string;
}

function generateDemandPdf(entries: DemandEntry[], type: "buy" | "order"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: "A4", margins: { top: 25, bottom: 25, left: 22, right: 22 } });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pw = doc.page.width;
    const m = 22;
    const cw = pw - 2 * m;
    let y = m;
    const pageH = doc.page.height;

    const title = type === "buy" ? "PURCHASE LIST" : "LAB ORDER LIST";

    // ── Header band ──
    doc.rect(0, 0, pw, 28).fillColor("#1e293b").fill();
    doc.fontSize(14).font("Helvetica-Bold").fillColor("white");
    doc.text(title, m, 9, { align: "center" });

    // ── Info line ──
    y = 38;
    doc.fontSize(8).font("Helvetica").fillColor("#64748b");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`, m, y);
    doc.text(`Items: ${entries.length}`, m + 220, y);
    doc.text(`KMJ Optical`, m + cw - 60, y);

    function checkPage(h: number) {
      if (y + h > pageH - 35) {
        doc.addPage();
        y = m;
        return true;
      }
      return false;
    }

    // ── Table header ──
    y += 14;
    checkPage(18);
    doc.rect(m, y, cw, 16).fillColor("#f8fafc").fill();
    doc.rect(m, y, cw, 16).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#475569");
    const cols = [
      { x: m + 6, w: 18 },
      { x: m + 24, w: 16 },
      { x: m + 42, w: 64 },
      { x: m + 108, w: 68 },
      { x: m + 178, w: 52 },
      { x: m + 232, w: cw - 238 },
    ];
    doc.text("#", cols[0].x, y + 4, { width: cols[0].w });
    doc.text("Eye", cols[1].x, y + 4, { width: cols[1].w });
    doc.text("Customer", cols[2].x, y + 4, { width: cols[2].w });
    doc.text("Lens", cols[3].x, y + 4, { width: cols[3].w });
    doc.text("Coating", cols[4].x, y + 4, { width: cols[4].w });
    doc.text("Prescription", cols[5].x, y + 4, { width: cols[5].w });
    y += 16;

    // ── Rows ──
    entries.forEach((e, idx) => {
      const rowH = 18;
      checkPage(rowH);

      // Row background (alternating)
      if (idx % 2 === 1) {
        doc.rect(m, y, cw, rowH).fillColor("#fafafa").fill();
      }

      // Border
      doc.rect(m, y, cw, rowH).lineWidth(0.3).strokeColor("#e2e8f0").stroke();

      doc.fontSize(7.5).font("Helvetica").fillColor("#1e293b");
      doc.text(String(idx + 1), cols[0].x, y + 5, { width: cols[0].w });
      doc.fontSize(7).font("Helvetica-Bold").fillColor(e.eye === "R" ? "#0891b2" : "#f59e0b");
      doc.text(e.eye, cols[1].x, y + 5, { width: cols[1].w });
      doc.fontSize(7).font("Helvetica").fillColor("#1e293b");
      doc.text(e.customerName, cols[2].x, y + 5, { width: cols[2].w, ellipsis: true });
      doc.fontSize(7).fillColor("#0891b2");
      doc.text(e.lensLabel, cols[3].x, y + 5, { width: cols[3].w, ellipsis: true });
      doc.fontSize(7).fillColor("#6366f1");
      doc.text(e.coating, cols[4].x, y + 5, { width: cols[4].w, ellipsis: true });
      doc.fontSize(6.5).font("Courier").fillColor("#475569");
      doc.text(e.rxStr, cols[5].x, y + 5, { width: cols[5].w });

      y += rowH;
    });

    // ── Footer ──
    if (y < pageH - 50) {
      doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(m, y + 8).lineTo(m + cw, y + 8).stroke();
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
      doc.text(`Generated by KMJ Optical ERP  |  ${title}  |  ${entries.length} items`, m, y + 14, { align: "center" });
    }

    doc.end();
  });
}

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const o = await Order.findByIdAndDelete(req.params.id);
  if (!o) throw new AppError(404, "Order not found");
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, message: "Deleted" });
}));

// POST /demand-send — generate demand PDF and send via WhatsApp
router.post("/demand-send", authenticate, async (req, res) => {
  try {
    const { type, orderIds } = req.body;
    if (!["buy", "order"].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be "buy" or "order"' });
    }

    // Find orders where either eye matches the type (or legacy classification matches)
    const query: Record<string, unknown> = {
      $or: [
        { rightLensStatus: type },
        { leftLensStatus: type },
        { classification: type },
      ],
    };
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      query._id = { $in: orderIds };
    }

    const orders = await Order.find(query)
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
    const ordersWithRx = orders.map(o => {
      const vid = ((o.visitId as any)?._id || o.visitId)?.toString();
      return { ...o, prescription: vid ? rxMap.get(vid) || null : null };
    });

    // Build per-eye entries
    interface DemandEntry {
      eye: string;
      customerName: string;
      lensLabel: string;
      coating: string;
      rxStr: string;
    }

    const entries: DemandEntry[] = [];
    for (const o of ordersWithRx) {
      const cName = (o.customerId as any)?.name || "—";
      const lensLabel = [o.lensBrand, o.lensType, o.lensIndex].filter(Boolean).join(" ") || "—";
      const coating = o.coating || "—";
      const rx = o.prescription;
      const rDV = rx?.rightEye?.dv;
      const lDV = rx?.leftEye?.dv;
      const rNV = rx?.rightEye?.nv;
      const lNV = rx?.leftEye?.nv;

      function formatRxStr(dv: any, nv: any, pd: any): string {
        const parts: string[] = [];
        if (dv?.sph != null) {
          const s = dv.sph > 0 ? `+${dv.sph}` : `${dv.sph}`;
          const c = dv.cyl != null ? (dv.cyl > 0 ? `/${+dv.cyl}` : `/${dv.cyl}`) : "";
          const a = dv.axis != null ? `x${dv.axis}` : "";
          parts.push(`${s}${c}${a}`);
          if (nv?.sph != null) parts.push(`Add ${(nv.sph - dv.sph).toFixed(2)}`);
        }
        if (pd) parts.push(`PD ${pd}`);
        return parts.join("  ") || "—";
      }

      const isRight = (o.rightLensStatus as string) === type;
      const isLeft = (o.leftLensStatus as string) === type;

      if (isRight) {
        entries.push({
          eye: "R",
          customerName: cName,
          lensLabel,
          coating,
          rxStr: formatRxStr(rDV, rNV, rx?.pd),
        });
      }
      if (isLeft) {
        entries.push({
          eye: "L",
          customerName: cName,
          lensLabel,
          coating,
          rxStr: formatRxStr(lDV, lNV, rx?.pd),
        });
      }
      // Fallback for legacy classification
      if (!isRight && !isLeft && (o.classification as string) === type) {
        entries.push({
          eye: "R/L",
          customerName: cName,
          lensLabel,
          coating,
          rxStr: (rDV?.sph != null || lDV?.sph != null)
            ? `R: ${formatRxStr(rDV, rNV, "")}  L: ${formatRxStr(lDV, lNV, "")}${rx?.pd ? `  PD ${rx.pd}` : ""}`
            : "—",
        });
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({ success: false, message: `No ${type} items found` });
    }

    const pdfBuffer = await generateDemandPdf(entries, type);
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
    console.log(`Demand PDF: ${filename}, ${sizeKB}KB, WA status: ${waStatus.status}`);

    const base64 = pdfBuffer.toString("base64");
    let sent = false;
    let sendError: string | null = null;

    try {
      sent = await whatsapp.sendMedia(normalized, base64, filename, "application/pdf", caption, true);
    } catch (e: any) {
      sendError = e.message;
      console.error(`Demand PDF sendMedia threw: ${e.message}`);
    }

    // Fallback: if media send failed but WA is connected, send as text
    if (!sent && waStatus.status === "connected" && !sendError) {
      console.log("Demand PDF sendMedia returned false, trying text fallback");
      try {
        const items = entries.map(e =>
          `${e.eye}  ${e.customerName} - ${e.lensLabel} | ${e.coating} | ${e.rxStr}`
        ).join("\n");
        const textMsg = `${title}\n\n${items}\n\nTotal: ${entries.length} items`;
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
      count: entries.length,
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
