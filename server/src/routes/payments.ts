import { Router } from "express";
import { Payment } from "../models/payment";
import { Bill } from "../models/bill";
import { z } from "zod";

const router = Router();

const createSchema = z.object({ customerId: z.string(), billId: z.string().optional(), amount: z.number(), paymentMode: z.string().optional(), paymentDate: z.string().optional() });

router.get("/", async (req, res) => {
  const list = await Payment.find().limit(200);
  res.json({ success: true, data: list });
});

router.post("/", async (req, res) => {
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
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
