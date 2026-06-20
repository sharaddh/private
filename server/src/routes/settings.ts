import { Router } from "express";
import { Settings } from "../models/settings";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/", authenticate, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    Object.assign(settings, req.body);
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
