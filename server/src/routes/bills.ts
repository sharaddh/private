import { Router } from "express";
import { Bill } from "../models/bill";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  items: z.array(z.object({ description: z.string(), quantity: z.number().optional(), unitPrice: z.number().optional() })).optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  advancePaid: z.number().optional()
});

router.get("/", authenticate, async (req, res) => {
  const list = await Bill.find().limit(100);
  res.json({ success: true, data: list });
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const billNumber = `BILL-${Date.now()}`;
    const subtotal = (p.items || []).reduce((s, it) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
    const total = subtotal - (p.discount || 0) + (p.tax || 0);
    const bill = new Bill({ billNumber, ...p, subtotal, totalAmount: total, pendingAmount: total - (p.advancePaid || 0) } as any);
    await bill.save();
    res.json({ success: true, data: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const b = await Bill.findById(req.params.id);
  if (!b) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: b });
});

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const p = req.body;
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Not found" });
    if (p.items) {
      bill.subtotal = (p.items || []).reduce((s: number, it: any) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
      bill.totalAmount = bill.subtotal - (p.discount ?? bill.discount) + (p.tax ?? bill.tax);
      bill.pendingAmount = bill.totalAmount - (p.advancePaid ?? bill.advancePaid);
    }
    Object.assign(bill, p);
    await bill.save();
    res.json({ success: true, data: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const b = await Bill.findByIdAndDelete(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
