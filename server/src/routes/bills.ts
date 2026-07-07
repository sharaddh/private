import { Router } from "express";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { Settings } from "../models/settings";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { audit } from "../middleware/audit";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { whatsapp } from "../services/whatsapp";
import { generateBillPdf } from "../utils/pdf";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  items: z.array(z.object({ description: z.string(), quantity: z.number().optional(), unitPrice: z.number().optional() })).optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  advancePaid: z.number().optional()
});

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const { customerId, startDate, endDate } = req.query;
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const s = new Date(startDate as string);
      s.setHours(0, 0, 0, 0);
      (filter.createdAt as Record<string, unknown>).$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      (filter.createdAt as Record<string, unknown>).$lte = e;
    }
  }
  const list = await Bill.find(filter)
    .populate("customerId", "name mobile customerId")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: list });
}));

router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const billNumber = `BILL-${Date.now()}`;
  const subtotal = (p.items || []).reduce((s, it) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
  const total = subtotal - (p.discount || 0) + (p.tax || 0);
  const pendingAmount = total - (p.advancePaid || 0);

  const bill = await Bill.create({
    billNumber, ...p, subtotal, totalAmount: total, pendingAmount,
  });

  await Customer.findByIdAndUpdate(p.customerId, {
    $inc: { totalSpent: total, pendingAmount },
  });

  // Send WhatsApp ΓÇö fire and forget (non-blocking)
  const customer = await Customer.findById(p.customerId).lean();
  if (customer?.mobile) {
    (async () => {
      try {
        const settings = await Settings.findOne().lean();
        const pdfBuffer = generateBillPdf(
          {
            billNumber: bill.billNumber, createdAt: bill.createdAt, items: bill.items,
            subtotal: bill.subtotal, discount: bill.discount, tax: bill.tax,
            advancePaid: bill.advancePaid, pendingAmount: bill.pendingAmount,
            totalAmount: bill.totalAmount, status: bill.status,
          },
          {
            name: customer.name, mobile: customer.mobile, address: customer.address, customerId: customer.customerId,
          },
          {
            shopName: settings?.shopName || "KMJ Optical", shopAddress: settings?.shopAddress || "",
            shopPhone: settings?.shopPhone || "", shopEmail: settings?.shopEmail || "", logo: settings?.logo || "",
          }
        );
        const message = `Hi ${customer.name}, your bill ${bill.billNumber} has been generated! Total: Γé╣${total.toFixed(2)}.`;
        if (customer.mobile) {
          await whatsapp.sendMedia(customer.mobile, pdfBuffer.toString("base64"), `${bill.billNumber}.pdf`, message);
        }
      } catch {
        // WhatsApp notification is optional
      }
    })();
  }

  await Promise.all([
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);
  res.json({ success: true, data: bill });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const b = await Bill.findById(req.params.id).populate("customerId", "name mobile customerId").lean();
  if (!b) throw new AppError(404, "Not found");
  res.json({ success: true, data: b });
}));

router.put("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const p = req.body;
  const bill = await Bill.findById(req.params.id);
  if (!bill) throw new AppError(404, "Not found");

  const oldTotal = bill.totalAmount || 0;
  const oldAdvance = bill.advancePaid || 0;
  const oldPending = bill.pendingAmount || 0;

  if (p.items) {
    bill.subtotal = (p.items || []).reduce((s: number, it: any) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
    bill.totalAmount = bill.subtotal - (p.discount ?? bill.discount) + (p.tax ?? bill.tax);
  }

  Object.assign(bill, p);

  // Always recalculate pendingAmount when advancePaid or items/discount/tax change
  bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - (bill.advancePaid || 0));

  await bill.save();

  const newTotal = bill.totalAmount || 0;
  const newPending = bill.pendingAmount || 0;
  const totalDiff = newTotal - oldTotal;
  const pendingDiff = newPending - oldPending;

  const customerUpdates: Record<string, number> = {};
  if (Math.abs(totalDiff) > 0.01) customerUpdates.totalSpent = totalDiff;
  if (Math.abs(pendingDiff) > 0.01) customerUpdates.pendingAmount = pendingDiff;

  if (Object.keys(customerUpdates).length > 0) {
    await Customer.findByIdAndUpdate(bill.customerId, { $inc: customerUpdates });
  }

  await Promise.all([
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);
  res.json({ success: true, data: bill });
}));

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const b = await Bill.findByIdAndDelete(req.params.id).lean();
  if (!b) throw new AppError(404, "Not found");
  await Customer.findByIdAndUpdate(b.customerId, {
    $inc: { totalSpent: -(b.totalAmount || 0), pendingAmount: -(b.pendingAmount || 0) },
  });
  await Promise.all([
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);
  res.json({ success: true, message: "Deleted" });
}));

export default router;
