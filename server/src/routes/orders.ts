import { Router } from "express";
import { Order } from "../models/order";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

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

router.get("/", async (req, res) => {
  const list = await Order.find().limit(100);
  res.json({ success: true, data: list });
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

router.get("/:id", async (req, res) => {
  const o = await Order.findById(req.params.id);
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

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
