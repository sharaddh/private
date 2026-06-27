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

router.put("/", authenticate, asyncHandler(async (req, res) => {
  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: req.body },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  res.json({ success: true, data: settings });
}));

export default router;
