import { Router } from "express";
import { Prescription } from "../models/prescription";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import { AppError } from "../middleware/errorHandler";

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

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const { customerId } = req.query;
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  const list = await Prescription.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: list });
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const customer = await Customer.findById(p.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");
  if (p.visitId) {
    const visit = await Visit.findById(p.visitId).lean();
    if (!visit) throw new AppError(404, "Visit not found");
  }
  const presc = await Prescription.create(p);
  res.json({ success: true, data: presc });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const p = await Prescription.findById(req.params.id).lean();
  if (!p) throw new AppError(404, "Not found");
  res.json({ success: true, data: p });
}));

router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  const p = createSchema.partial().parse(req.body);
  const updated = await Prescription.findByIdAndUpdate(req.params.id, { $set: p }, { new: true, runValidators: true }).lean();
  if (!updated) throw new AppError(404, "Not found");
  res.json({ success: true, data: updated });
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const p = await Prescription.findByIdAndDelete(req.params.id).lean();
  if (!p) throw new AppError(404, "Not found");
  res.json({ success: true, message: "Deleted" });
}));

export default router;
