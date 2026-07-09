import { Router } from "express";
import { Settings } from "../models/settings";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  let settings = await Settings.findOne().lean();
  if (!settings) {
    settings = await Settings.create({});
  }
  res.json({ success: true, data: settings });
}));

const allowedSettings = [
  "shopName", "shopPhone", "shopAddress", "gstin", "email", "invoicePrefix",
  "defaultDiscount", "taxRate", "currency", "timezone", "whatsappNumber",
  "orderMessage", "deliveryMessage", "receiptFooter", "theme"
];

router.put("/", authenticate, asyncHandler(async (req, res) => {
  const updates: Record<string, unknown> = {};
  for (const key of allowedSettings) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  res.json({ success: true, data: settings });
}));

export default router;
