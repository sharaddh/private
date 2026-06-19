import { Router } from "express";
import { Customer } from "../models/customer";
import { z } from "zod";

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  alternateMobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  age: z.number().int().positive().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  tags: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
      return value;
    },
    z.array(z.string()).optional()
  )
});

router.get("/", async (req, res) => {
  const q = (req.query.q as string) || "";
  const customers = await Customer.find(
    q ? { $or: [{ name: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }] } : {}
  )
    .sort({ createdAt: -1 })
    .limit(100);
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

router.put("/:id", async (req, res) => {
  try {
    const parsed = createCustomerSchema.partial().parse(req.body);
    const c = await Customer.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: c });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const c = await Customer.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
