import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { whatsapp } from "../services/whatsapp";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.get("/status", authenticate, asyncHandler(async (_req, res) => {
  const status = await whatsapp.getStatus();
  res.json({ success: true, data: status });
}));

router.get("/qr", authenticate, asyncHandler(async (_req, res) => {
  const status = await whatsapp.getStatus();
  res.json({ success: true, data: { qr: status.status === "qr" ? status.qr : null, status: status.status } });
}));

router.get("/queue", authenticate, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { queueLength: whatsapp.queueLength } });
}));

router.post("/send", authenticate, asyncHandler(async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) throw new AppError(400, "Phone and message required");
  const ok = await whatsapp.sendMessage(phone, message);
  const status = await whatsapp.getStatus();
  res.json({
    success: true,
    sent: ok,
    queued: !ok && status.status !== "connected",
    message: ok ? "Sent" : status.status === "connected" ? "Failed to send" : "Queued - will send when WhatsApp connects",
  });
}));

router.post("/send-media", authenticate, asyncHandler(async (req, res) => {
  const { phone, base64, filename, caption } = req.body;
  if (!phone || !base64 || !filename) throw new AppError(400, "Phone, base64 and filename required");
  const ok = await whatsapp.sendMedia(phone, base64, filename, caption);
  const status = await whatsapp.getStatus();
  res.json({
    success: true,
    sent: ok,
    queued: !ok && status.status !== "connected",
    message: ok ? "Sent" : status.status === "connected" ? "Failed to send" : "Queued - will send when WhatsApp connects",
  });
}));

router.post("/disconnect", authenticate, asyncHandler(async (req, res) => {
  await whatsapp.disconnect();
  whatsapp.init().catch(() => {});
  res.json({ success: true, message: "WhatsApp disconnected" });
}));

router.post("/pair", authenticate, asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) throw new AppError(400, "Phone number required");
  const code = await whatsapp.requestPairingCode(phone);
  res.json({ success: true, data: { pairingCode: code } });
}));

router.post("/init", authenticate, asyncHandler(async (req, res) => {
  await whatsapp.disconnect();
  whatsapp.init().catch(() => {});
  res.json({ success: true, message: "WhatsApp re-initialization triggered" });
}));

router.post("/broadcast", authenticate, asyncHandler(async (req, res) => {
  const { numbers, message } = req.body;
  if (!numbers?.length || !message) throw new AppError(400, "Numbers and message required");
  const result = await whatsapp.broadcast(numbers, message);
  res.json({ success: true, data: result });
}));

export default router;
