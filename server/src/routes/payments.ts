import { Router } from "express";
import { Payment } from "../models/payment";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

const createSchema = z.object({ customerId: z.string(), billId: z.string().optional(), amount: z.number().min(0.01), paymentMode: z.string().optional(), paymentDate: z.string().optional(), notes: z.string().optional() });

router.get("/", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const filter: any = {};
  if (startDate || endDate) {
    filter.paymentDate = {};
    if (startDate) {
      const s = new Date(startDate as string);
      s.setHours(0, 0, 0, 0);
      filter.paymentDate.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = e;
    }
  }
  const list = await Payment.find(filter).populate("customerId", "name mobile customerId").sort({ paymentDate: -1 }).limit(500);
  res.json({ success: true, data: list });
});

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const oldPayment = await Payment.findById(req.params.id);
    if (!oldPayment) return res.status(404).json({ success: false, message: "Not found" });

    const oldAmount = oldPayment.amount;
    const newAmount = req.body.amount ?? oldAmount;
    const diff = newAmount - oldAmount;

    const updateData: any = { ...req.body };
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
      const customer = await Customer.findById(oldPayment.customerId);
      if (customer) {
        customer.pendingAmount = Math.max(0, (customer.pendingAmount || 0) - diff);
        await customer.save();
      }
    }

    res.json({ success: true, data: oldPayment });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const p = await Payment.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const payment = new Payment({ ...p, paymentDate: p.paymentDate ? new Date(p.paymentDate) : undefined } as any);
    await payment.save();
    // update bill pending amount
    if (p.billId) {
      const bill = await Bill.findById(p.billId);
      if (bill) {
        bill.advancePaid = (bill.advancePaid || 0) + p.amount;
        bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
        await bill.save();
      }
    }
    const customer = await Customer.findById(p.customerId);
    if (customer) {
      customer.pendingAmount = Math.max(0, (customer.pendingAmount || 0) - p.amount);
      await customer.save();
    }

    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
