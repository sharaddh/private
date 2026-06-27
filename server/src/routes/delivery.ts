import { Router } from "express";
import { Delivery } from "../models/delivery";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const list = await Delivery.find(filter)
    .populate("customerId", "name mobile")
    .populate("orderId", "frame lens status")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: list });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const d = await Delivery.findById(req.params.id)
    .populate("customerId", "name mobile")
    .populate("orderId", "frame lens status")
    .lean();
  if (!d) throw new AppError(404, "Not found");
  res.json({ success: true, data: d });
}));

export default router;
