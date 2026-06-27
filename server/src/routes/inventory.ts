import { Router } from "express";
import { Inventory } from "../models/inventory";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { audit } from "../middleware/audit";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import QRCode from "qrcode";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const createSchema = z.object({
  sku: z.string().min(1),
  category: z.string().optional(),
  inventoryType: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  gender: z.string().optional(),
  supplier: z.string().optional(),
  quantity: z.number().optional(),
  purchasePrice: z.number().optional(),
  sellingPrice: z.number().optional(),
  description: z.string().optional(),
  location: z.enum(["shop", "warehouse"]).optional(),
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", authenticate, cacheRoute(60), asyncHandler(async (req, res) => {
  const q = (req.query.q as string) || "";
  const filter = q
    ? {
        $or: [
          { sku: { $regex: escapeRegex(q), $options: "i" } },
          { brand: { $regex: escapeRegex(q), $options: "i" } },
          { model: { $regex: escapeRegex(q), $options: "i" } },
          { category: { $regex: escapeRegex(q), $options: "i" } },
          { supplier: { $regex: escapeRegex(q), $options: "i" } },
        ],
      }
    : {};
  const list = await Inventory.find(filter).limit(200).lean();
  res.json({ success: true, data: list });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id).lean();
  if (!item) throw new AppError(404, "Not found");
  res.json({ success: true, data: item });
}));

router.get("/qr/:code", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findOne({ sku: req.params.code }).lean();
  if (!item) throw new AppError(404, "Item not found");
  res.json({ success: true, data: item });
}));

router.get("/:id/qr-image", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id).lean();
  if (!item) throw new AppError(404, "Not found");
  const qrBuffer = await QRCode.toBuffer(item.sku || "", {
    type: "png", width: 400, margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  res.set("Content-Type", "image/png");
  res.send(qrBuffer);
}));

router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const item = await Inventory.create(p);
  await invalidateCache("/api/inventory");
  res.json({ success: true, data: item });
}));

router.put("/:id/stock", authenticate, audit, asyncHandler(async (req, res) => {
  const qty = Number(req.body.quantity || 0);
  const it = await Inventory.findByIdAndUpdate(
    req.params.id,
    { $inc: { quantity: qty } },
    { new: true }
  ).lean();
  if (!it) throw new AppError(404, "Not found");
  await invalidateCache("/api/inventory");
  res.json({ success: true, data: it });
}));

router.put("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const it = await Inventory.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).lean();
  if (!it) throw new AppError(404, "Not found");
  await invalidateCache("/api/inventory");
  res.json({ success: true, data: it });
}));

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const it = await Inventory.findByIdAndDelete(req.params.id).lean();
  if (!it) throw new AppError(404, "Not found");
  await invalidateCache("/api/inventory");
  res.json({ success: true, message: "Deleted" });
}));

export default router;
