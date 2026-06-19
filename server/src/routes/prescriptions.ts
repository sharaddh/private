import { Router } from "express";
import { Prescription } from "../models/prescription";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { z } from "zod";

const router = Router();

const eyeSchema = z.object({
  sph: z.number().optional(),
  cyl: z.number().optional(),
  axis: z.number().optional(),
  va: z.string().optional(),
});

const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  rightEye: z.object({ dv: eyeSchema.optional(), nv: eyeSchema.optional(), pc: eyeSchema.optional() }).optional(),
  leftEye: z.object({ dv: eyeSchema.optional(), nv: eyeSchema.optional(), pc: eyeSchema.optional() }).optional(),
  pd: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req, res) => {
  try {
    const { customerId } = req.query;
    const filter: any = {};
    if (customerId) filter.customerId = customerId;
    const list = await Prescription.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const customer = await Customer.findById(p.customerId);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    if (p.visitId) {
      const visit = await Visit.findById(p.visitId);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
    }
    const presc = new Prescription(p as any);
    await presc.save();
    res.json({ success: true, data: presc });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const p = await Prescription.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: p });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const p = await Prescription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: p });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const p = await Prescription.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
