import { Router } from "express";
import { Delivery } from "../models/delivery";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

const createSchema = z.object({ customerId: z.string(), orderId: z.string().optional(), address: z.string().optional(), expectedDeliveryDate: z.string().optional(), status: z.string().optional() });

router.get("/", async (req, res) => {
  const list = await Delivery.find().limit(200);
  res.json({ success: true, data: list });
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const d = new Delivery({
      ...p,
      expectedDeliveryDate: p.expectedDeliveryDate ? new Date(p.expectedDeliveryDate) : undefined,
    } as any);
    await d.save();
    res.json({ success: true, data: d });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const d = await Delivery.findById(req.params.id);
  if (!d) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: d });
});

export default router;
