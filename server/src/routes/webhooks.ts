import { Router, raw } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  receiveWebhook,
  verifyWebhook,
} from "../controllers/whatsappWebhook.controller";

const router = Router();

router.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

router.get("/whatsapp", verifyWebhook);
router.post(
  "/whatsapp",
  raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(receiveWebhook)
);

export default router;
