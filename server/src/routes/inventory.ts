import { Router } from "express";
import { Inventory } from "../models/inventory";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";
import QRCode from "qrcode";
 
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
});

router.get("/", authenticate, async (req, res) => {
  const q = (req.query.q as string) || "";
  const filter = q
    ? {
        $or: [
          { sku: { $regex: q, $options: "i" } },
          { brand: { $regex: q, $options: "i" } },
          { model: { $regex: q, $options: "i" } },
          { category: { $regex: q, $options: "i" } },
        ],
      }
    : {};
  const list = await Inventory.find(filter).limit(200);
  res.json({ success: true, data: list });
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const item = new Inventory(p as any);
    await item.save();
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id/stock", authenticate, audit, async (req, res) => {
  try {
    const qty = Number(req.body.quantity || 0);
    const it = await Inventory.findById(req.params.id);
    if (!it) return res.status(404).json({ success: false, message: "Not found" });
    it.quantity = (it.quantity || 0) + qty;
    await it.save();
    res.json({ success: true, data: it });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const it = await Inventory.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!it) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: it });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const it = await Inventory.findByIdAndDelete(req.params.id);
    if (!it) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
