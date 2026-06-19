import { Router } from "express";
import { Customer } from "../models/customer";
import { Order } from "../models/order";
import { Prescription } from "../models/prescription";
import { Visit } from "../models/visit";
import { z } from "zod";
import { authenticate } from "../middleware/auth";

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
  const phone = req.query.phone as string;
  if (phone) {
    const customers = await Customer.find({ mobile: phone });
    return res.json({ success: true, data: customers || [] });
  }
  const customers = await Customer.find(
    q ? { $or: [{ name: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }, { customerId: new RegExp(q, "i") }] } : {}
  )
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, data: customers });
});

router.post("/", authenticate, async (req, res) => {
  try {
    const parsed = createCustomerSchema.parse(req.body);
    const customer = new Customer({ ...parsed, customerId: `CUST-${Date.now()}` });
    await customer.save();
    res.json({ success: true, data: customer });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /summary/:id — rich customer card data (placed before /:id to avoid route conflict)
router.get("/summary/:id", async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: "Not found" });

    const [visits, prescs, orders] = await Promise.all([
      Visit.find({ customerId: c._id }).sort({ visitDate: -1 }).limit(5),
      Prescription.find({ customerId: c._id }).sort({ createdAt: -1 }).limit(1),
      Order.find({ customerId: c._id }).sort({ createdAt: -1 }).limit(3),
    ]);

    const lastVisit = visits.length > 0 ? visits[0] : null;
    const lastPresc = prescs.length > 0 ? prescs[0] : null;
    const lastOrder = orders.length > 0 ? orders[0] : null;
    const labOrders = orders.filter((o) => o.status === "In Lab" || o.status === "Ordered");
    const readyOrders = orders.filter((o) => o.status === "Ready");

    res.json({
      success: true,
      data: {
        customer: c,
        lastVisit,
        lastPrescription: lastPresc,
        lastOrder,
        recentOrders: orders,
        labOrders: labOrders.length,
        readyOrders: readyOrders.length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const c = await Customer.findById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: c });
});

router.put("/:id", authenticate, async (req, res) => {
  try {
    const parsed = createCustomerSchema.partial().parse(req.body);
    const c = await Customer.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: c });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const c = await Customer.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
