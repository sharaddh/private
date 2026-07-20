import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendTextSchema, sendMediaSchema, broadcastSchema } from "../validators/whatsapp.validator";
import {
  getStatus,
  sendText,
  sendMedia,
  broadcast,
  abortBroadcast,
} from "../controllers/whatsapp.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/status", authenticate, asyncHandler(getStatus));
router.post("/send", authenticate, validate(sendTextSchema), asyncHandler(sendText));
router.post("/send-media", authenticate, validate(sendMediaSchema), asyncHandler(sendMedia));
router.post("/broadcast", authenticate, validate(broadcastSchema), asyncHandler(broadcast));
router.post("/broadcast/abort", authenticate, asyncHandler(abortBroadcast));

export default router;
