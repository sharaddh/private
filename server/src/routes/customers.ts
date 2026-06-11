import { Router } from "express";
import { Customer } from "../models/customer";
import { z } from "zod";

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().optional(),
  city: z.string().optional()
});

router.get("/", async (req, res) => {
  const q = (req.query.q as string) || "";
  const customers = await Customer.find(
    q ? { $or: [{ name: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }] } : {}
  ).limit(50);
  res.json({ success: true, data: customers });
});

router.post("/", async (req, res) => {
  try {
    const parsed = createCustomerSchema.parse(req.body);
    const customer = new Customer({ ...parsed, customerId: `CUST-${Date.now()}` });
    await customer.save();
    res.json({ success: true, data: customer });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const c = await Customer.findById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: c });
});

export default router;
