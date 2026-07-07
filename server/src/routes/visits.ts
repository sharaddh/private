import { Router } from "express";
import { Visit } from "../models/visit";
import { Customer } from "../models/customer";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const createSchema = z.object({
  customerId: z.string(),
  visitDate: z.string().optional(),
  doctorName: z.string().optional(),
  shopId: z.string().optional(),
  remarks: z.string().optional(),
});

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const { customerId } = req.query;
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  const list = await Visit.find(filter).sort({ visitDate: -1 }).limit(200).lean();
  res.json({ success: true, data: list });
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const customer = await Customer.findById(p.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");
  const visit = await Visit.create({
    ...p,
    visitDate: p.visitDate ? new Date(p.visitDate) : new Date(),
  });
  await Customer.findByIdAndUpdate(p.customerId, { $inc: { totalVisits: 1 } });
  await invalidateCache("/api/visits");
  res.json({ success: true, data: visit });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const v = await Visit.findById(req.params.id).lean();
  if (!v) throw new AppError(404, "Not found");
  res.json({ success: true, data: v });
}));

router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  const v = await Visit.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).lean();
  if (!v) throw new AppError(404, "Not found");
  await invalidateCache("/api/visits");
  res.json({ success: true, data: v });
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const v = await Visit.findByIdAndDelete(req.params.id).lean();
  if (!v) throw new AppError(404, "Not found");
  await Customer.findByIdAndUpdate(v.customerId, { $inc: { totalVisits: -1 } });
  await invalidateCache("/api/visits");
  res.json({ success: true, message: "Deleted" });
}));

export default router;
