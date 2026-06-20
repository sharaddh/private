import { Router } from "express";
import { Visit } from "../models/visit";
import { Customer } from "../models/customer";
import { z } from "zod";
import { authenticate } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  customerId: z.string(),
  visitDate: z.string().optional(),
  doctorName: z.string().optional(),
  shopId: z.string().optional(),
  remarks: z.string().optional(),
});

router.get("/", authenticate, async (req, res) => {
  try {
    const { customerId } = req.query;
    const filter: any = {};
    if (customerId) filter.customerId = customerId;
    const list = await Visit.find(filter).sort({ visitDate: -1 }).limit(200);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const customer = await Customer.findById(p.customerId);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    const visit = new Visit({
      ...p,
      visitDate: p.visitDate ? new Date(p.visitDate) : new Date(),
    } as any);
    await visit.save();
    customer.totalVisits = (customer.totalVisits || 0) + 1;
    await customer.save();
    res.json({ success: true, data: visit });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const v = await Visit.findById(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: v });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", authenticate, async (req, res) => {
  try {
    const v = await Visit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!v) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: v });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const v = await Visit.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
