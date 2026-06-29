import { Router } from "express";
import { Payment } from "../models/payment";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { audit } from "../middleware/audit";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const createSchema = z.object({ customerId: z.string(), billId: z.string().optional(), amount: z.number().min(0.01), paymentMode: z.string().optional(), paymentDate: z.string().optional(), notes: z.string().optional() });

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const { startDate, endDate, customerId, billId } = req.query;
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  if (billId) filter.billId = billId;
  if (startDate || endDate) {
    filter.paymentDate = {};
    if (startDate) {
      const s = new Date(startDate as string);
      s.setHours(0, 0, 0, 0);
      (filter.paymentDate as Record<string, unknown>).$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      (filter.paymentDate as Record<string, unknown>).$lte = e;
    }
  }
  const list = await Payment.find(filter)
    .populate("customerId", "name mobile customerId")
    .sort({ paymentDate: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: list });
}));

router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const payment = await Payment.create({
    ...p,
    paymentDate: p.paymentDate ? new Date(p.paymentDate) : undefined,
  });
  if (p.billId) {
    const bill = await Bill.findByIdAndUpdate(p.billId, {
      $inc: { advancePaid: p.amount },
    }, { new: true });
    if (bill) {
      bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - (bill.advancePaid || 0));
      await bill.save();
    }
  }
  await Customer.findByIdAndUpdate(p.customerId, {
    $inc: { pendingAmount: -p.amount },
  });
  await Promise.all([
    invalidateCache("/api/payments"),
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);
  res.json({ success: true, data: payment });
}));

router.put("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const oldPayment = await Payment.findById(req.params.id);
  if (!oldPayment) throw new AppError(404, "Not found");

  const oldAmount = oldPayment.amount;
  const newAmount = req.body.amount ?? oldAmount;
  const diff = newAmount - oldAmount;

  const updateData = { ...req.body };
  if (Math.abs(diff) > 0.01) {
    const changeNote = `Amount changed from ₹${oldAmount.toFixed(0)} to ₹${newAmount.toFixed(0)}`;
    const existingNotes = updateData.notes || oldPayment.notes || "";
    updateData.notes = existingNotes ? `${existingNotes} | ${changeNote}` : changeNote;
  }

  Object.assign(oldPayment, updateData);
  await oldPayment.save();

  if (oldPayment.billId && Math.abs(diff) > 0.01) {
    const bill = await Bill.findById(oldPayment.billId);
    if (bill) {
      bill.advancePaid = Math.max(0, (bill.advancePaid || 0) + diff);
      bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
      await bill.save();
    }
    await Customer.findByIdAndUpdate(oldPayment.customerId, {
      $inc: { pendingAmount: -diff },
    });
  }

  await invalidateCache("/api/payments");
  res.json({ success: true, data: oldPayment });
}));

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const p = await Payment.findByIdAndDelete(req.params.id).lean();
  if (!p) throw new AppError(404, "Not found");
  await invalidateCache("/api/payments");
  res.json({ success: true, message: "Deleted" });
}));

export default router;
