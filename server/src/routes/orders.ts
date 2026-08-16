import { Router } from "express";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Delivery } from "../models/delivery";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Settings } from "../models/settings";
import { Prescription } from "../models/prescription";
import { whatsappManager } from "../services/whatsapp";
import PDFKit from "pdfkit";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { normalizePhone } from "../utils/phone";
import { formatISTDate, formatISTDateTime } from "../utils/date";
import { VALID_TRANSITIONS } from "../types";
import { requireBranchId } from "../utils/scope";
import {
  createOrderSchema,
  updateOrderSchema,
  statusUpdateSchema,
  classifyOrderSchema,
  classifyEyeSchema,
  demandSendSchema,
  collectPaymentSchema,
} from "../validators/order.validator";
import * as orderController from "../controllers/orderController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(orderController.list));

router.post(
  "/",
  authenticate,
  audit,
  validate(createOrderSchema, "body"),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findUnique({ where: { id: req.body.customerId } });
    if (!customer) throw new AppError(404, "Customer not found");
    await orderController.create(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.get("/:id", authenticate, asyncHandler(orderController.getById));

router.put(
  "/:id",
  authenticate,
  audit,
  validate(updateOrderSchema, "body"),
  asyncHandler(async (req, res) => {
    await orderController.update(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.patch(
  "/:id/classify",
  authenticate,
  validate(classifyOrderSchema, "body"),
  asyncHandler(orderController.setClassification)
);

router.patch(
  "/:id/classify-eye",
  authenticate,
  validate(classifyEyeSchema, "body"),
  asyncHandler(orderController.setEyeClassification)
);

router.patch("/:id/review", authenticate, asyncHandler(orderController.setReviewed));

router.patch(
  "/:id/status",
  authenticate,
  validate(statusUpdateSchema, "body"),
  async (req, res) => {
    try {
      const wa = whatsappManager.getInstance((req as any).branchId);
      const { status, collectPayment, paymentMode, advanceQuantity } = statusUpdateSchema.parse(
        req.body
      );
      const order = await Order.findUnique({ where: { id: req.params.id } });
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

      const updateData: Record<string, unknown> = {};
      if (newForwarded >= qty) {
        updateData.status = status;
        updateData.forwardedCount = 0;
        if (status === "Delivered") updateData.actualDeliveryDate = new Date();
      } else {
        updateData.forwardedCount = newForwarded;
      }
      const updatedOrder = await Order.update({ where: { id: order.id }, data: updateData });

      const result: any = {
        order: updatedOrder,
        partial: newForwarded < qty,
        forwardedCount: newForwarded < qty ? newForwarded : 0,
      };

      const delivery = await Delivery.findFirst({ where: { orderId: order.id } });
      if (delivery && newForwarded >= qty) {
        const deliveryData: Record<string, unknown> = {};
        if (status === "Ready") {
          deliveryData.status = "Ready";
        } else if (status === "Delivered") {
          deliveryData.status = "Delivered";
          deliveryData.actualDeliveryDate = new Date();
        } else if (status === "Cancelled") {
          deliveryData.status = "Cancelled";
        }
        if (Object.keys(deliveryData).length > 0) {
          await Delivery.update({ where: { id: delivery.id }, data: deliveryData });
          result.delivery = { ...delivery, ...deliveryData };
        }
      }

      if (status === "Ready" && newForwarded >= qty) {
        const customer = await Customer.findUnique({
          where: { id: order.customerId },
          select: { name: true, mobile: true },
        });
        if (customer?.mobile) {
          const settings = await Settings.findFirst({ orderBy: { createdAt: "desc" } });
          const shop = settings?.shopName || "KMJ Optical";
          const items = [order.frame, order.lens, order.coating].filter(Boolean).join(", ");
          const deliveryDate = order.deliveryDate ? formatISTDate(order.deliveryDate) : "soon";
          const msg = `*${shop}* 🕶\n\nHi ${customer.name},\nYour order is ready for pickup! 🎉\n\n${items ? `Items: ${items}\n` : ""}Delivery Date: ${deliveryDate}\n\nPlease visit the store to collect your order.\nThank you! 🙏`;
          const readyPhone = normalizePhone(customer.mobile);
          const readyDelay = 2000 + Math.random() * 3000;
          setTimeout(async () => {
            const sent = await wa.sendMessage(readyPhone, msg);
            if (!sent.ok)
              console.error(`WhatsApp: order ${order.id} ready message failed:`, sent.error);
          }, readyDelay);
        }
      }

      if (status === "Delivered" && newForwarded >= qty) {
        const customer = await Customer.findUnique({
          where: { id: order.customerId },
          select: { name: true, mobile: true },
        });
        if (customer?.mobile) {
          const settings = await Settings.findFirst({ orderBy: { createdAt: "desc" } });
          const shop = settings?.shopName || "KMJ Optical";
          const msg = `*${shop}* 🕶\n\nHi ${customer.name},\nYour order has been delivered! 🎉\n\nThank you for choosing ${shop}.\nSee you again! 🙏`;
          const deliveredPhone = normalizePhone(customer.mobile);
          const deliveredDelay = 2000 + Math.random() * 3000;
          setTimeout(async () => {
            const sent = await wa.sendMessage(deliveredPhone, msg);
            if (!sent.ok)
              console.error(`WhatsApp: order ${order.id} delivered message failed:`, sent.error);
          }, deliveredDelay);
        }
      }

      if (status === "Delivered" && newForwarded >= qty && collectPayment && collectPayment > 0) {
        let bill = await Bill.findFirst({ where: { visitId: order.visitId || order.id } });
        if (!bill) {
          bill = await Bill.findFirst({
            where: { customerId: order.customerId },
            orderBy: { createdAt: "desc" },
          });
        }
        if (bill && bill.pendingAmount > 0) {
          const payment = await Payment.create({
            data: {
              customerId: order.customerId,
              billId: bill.id,
              amount: collectPayment,
              paymentMode: paymentMode || "Cash",
              paymentDate: new Date(),
              notes: `Collected on delivery (order ${order.id})`,
              branchId: requireBranchId(),
            },
          });
          const newAdvancePaid = (bill.advancePaid || 0) + collectPayment;
          const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
          await Bill.update({
            where: { id: bill.id },
            data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
          });
          result.payment = payment;
          result.bill = { ...bill, advancePaid: newAdvancePaid, pendingAmount: newPendingAmount };

          await Customer.update({
            where: { id: order.customerId },
            data: { pendingAmount: { decrement: collectPayment } },
          });
        }
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  "/:id/collect-payment",
  authenticate,
  validate(collectPaymentSchema, "body"),
  async (req, res) => {
    try {
      const { collectPayment, paymentMode } = req.body;
      if (!collectPayment || collectPayment <= 0) {
        return res.status(400).json({ success: false, message: "Invalid payment amount" });
      }

      const order = await Order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      let bill = await Bill.findFirst({ where: { visitId: order.visitId || order.id } });
      if (!bill) {
        bill = await Bill.findFirst({
          where: { customerId: order.customerId },
          orderBy: { createdAt: "desc" },
        });
      }
      if (!bill) {
        return res.status(404).json({ success: false, message: "No bill found for this order" });
      }
      if (bill.pendingAmount <= 0) {
        return res.status(400).json({ success: false, message: "No pending amount on this bill" });
      }

      const actualCollect = Math.min(collectPayment, bill.pendingAmount);
      const payment = await Payment.create({
        data: {
          customerId: order.customerId,
          billId: bill.id,
          amount: actualCollect,
          paymentMode: paymentMode || "Cash",
          paymentDate: new Date(),
          notes: `Collected after delivery (order ${order.id})`,
          branchId: requireBranchId(),
        },
      });
      const newAdvancePaid = (bill.advancePaid || 0) + actualCollect;
      const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
      await Bill.update({
        where: { id: bill.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
      });

      await Customer.update({
        where: { id: order.customerId },
        data: { pendingAmount: { decrement: actualCollect } },
      });

      invalidateCache("/api/orders");
      invalidateCache("/api/dashboard");

      res.json({ success: true, data: { payment, bill: { ...bill, advancePaid: newAdvancePaid, pendingAmount: newPendingAmount } } });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  audit,
  asyncHandler(async (req, res) => {
    await orderController.remove(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

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
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pw = doc.page.width;
    const m = 22;
    const cw = pw - 2 * m;
    let y = m;
    const pageH = doc.page.height;

    const title = type === "buy" ? "PURCHASE LIST" : "LAB ORDER LIST";

    doc.rect(0, 0, pw, 28).fillColor("#1e293b").fill();
    doc.fontSize(14).font("Helvetica-Bold").fillColor("white");
    doc.text(title, m, 9, { align: "center" });

    y = 38;
    doc.fontSize(8).font("Helvetica").fillColor("#64748b");
    doc.text(`Date: ${formatISTDateTime(new Date())}`, m, y);
    doc.text(`Items: ${entries.length}`, m + 220, y);
    doc.text(`KMJ Optical`, m + cw - 60, y);

    function checkPage(h: number): boolean {
      if (y + h > pageH - 35) {
        doc.addPage();
        y = m;
        return true;
      }
      return false;
    }

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

    entries.forEach((e: DemandEntry, idx: number) => {
      const rowH = 18;
      checkPage(rowH);

      if (idx % 2 === 1) {
        doc.rect(m, y, cw, rowH).fillColor("#fafafa").fill();
      }

      doc.rect(m, y, cw, rowH).lineWidth(0.3).strokeColor("#e2e8f0").stroke();

      doc.fontSize(7.5).font("Helvetica").fillColor("#1e293b");
      doc.text(String(idx + 1), cols[0].x, y + 5, { width: cols[0].w });
      doc
        .fontSize(7)
        .font("Helvetica-Bold")
        .fillColor(e.eye === "R" ? "#0891b2" : "#f59e0b");
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

    if (y < pageH - 50) {
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(0.5)
        .moveTo(m, y + 8)
        .lineTo(m + cw, y + 8)
        .stroke();
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
      doc.text(`Generated by KMJ Optical ERP  |  ${title}  |  ${entries.length} items`, m, y + 14, {
        align: "center",
      });
    }

    doc.end();
  });
}

router.post("/demand-send", authenticate, validate(demandSendSchema, "body"), async (req, res) => {
  try {
    const wa = whatsappManager.getInstance((req as any).branchId);
    const { type, orderIds } = req.body;
    if (!["buy", "order"].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be "buy" or "order"' });
    }

    const where: Record<string, unknown> = {
      OR: [{ rightLensStatus: type }, { leftLensStatus: type }, { classification: type }],
    };
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      where.id = { in: orderIds };
    }

    const orders = await Order.findMany({
      where,
      include: {
        customer: { select: { name: true, mobile: true } },
        visit: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: `No ${type} items found` });
    }

    const visitIds = orders
      .map((o: any) => {
        const visit = o.visitId as any;
        return visit?.id || null;
      })
      .filter(Boolean) as string[];
    const prescriptions =
      visitIds.length > 0
        ? await Prescription.findMany({ where: { visitId: { in: visitIds } } })
        : [];
    const rxMap = new Map(prescriptions.map((p: any) => [p.visitId || "", p]));
    const ordersWithRx = orders.map((o: any) => {
      const visit = o.visitId as any;
      const vid = visit?.id;
      return { ...o, prescription: vid ? rxMap.get(vid) || null : null };
    });

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
          const fmtVal = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
          const s = fmtVal(dv.sph);
          const c = dv.cyl != null ? ` / ${fmtVal(dv.cyl)}` : "";
          const a = dv.axis != null ? ` × ${dv.axis}` : "";
          parts.push(`SPH ${s}${c}${a}`);
          if (nv?.sph != null) parts.push(`ADD ${fmtVal(nv.sph - dv.sph)}`);
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
      if (!isRight && !isLeft && (o.classification as string) === type) {
        entries.push({
          eye: "R/L",
          customerName: cName,
          lensLabel,
          coating,
          rxStr:
            rDV?.sph != null || lDV?.sph != null
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
    const caption =
      type === "buy"
        ? "Purchase List - Items to buy from supplier"
        : "Lab Order List - Items to order from lab";

    const settings = await Settings.findFirst({ orderBy: { createdAt: "desc" } });
    let phone = settings?.shopPhone?.replace(/\D/g, "");
    if (!phone) {
      return res.status(400).json({ success: false, message: "Shop phone not configured" });
    }
    phone = phone.replace(/^0+/, "");
    const normalized = phone.length === 10 ? `91${phone}` : phone;
    const waStatus = await wa.getStatus();

    const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
    console.log(`Demand PDF: ${filename}, ${sizeKB}KB, WA status: ${waStatus.status}`);

    const base64 = pdfBuffer.toString("base64");
    let sent = false;
    let sendError: string | null = null;

    try {
      const sendResult = await wa.sendMedia(
        normalized,
        base64,
        filename,
        "application/pdf",
        caption,
        true
      );
      sent = sendResult.ok;
      if (!sendResult.ok && sendResult.error) sendError = sendResult.error;
    } catch (e: any) {
      sendError = e.message;
      console.error(`Demand PDF sendMedia threw: ${e.message}`);
    }

    if (!sent && waStatus.status === "connected" && !sendError) {
      console.log("Demand PDF sendMedia returned false, trying text fallback");
      try {
        const items = entries
          .map((e: DemandEntry) => `${e.eye}  ${e.customerName} - ${e.lensLabel} | ${e.coating} | ${e.rxStr}`)
          .join("\n");
        const textMsg = `${title}\n\n${items}\n\nTotal: ${entries.length} items`;
        await wa.sendMessage(normalized, textMsg);
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
