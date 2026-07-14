import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { whatsappManager } from "../services/whatsapp";
import { AppError } from "../middleware/errorHandler";
import type { BranchRequest } from "../middleware/branch";

const router = Router();

router.get("/status", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  const status = await wa.getStatus();
  res.json({ success: true, data: status });
}));

router.get("/qr", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  const status = await wa.getStatus();
  res.json({ success: true, data: { qr: status.status === "qr" ? status.qr : null, status: status.status } });
}));

router.get("/queue", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  res.json({ success: true, data: { queueLength: wa.queueLength } });
}));

router.post("/send", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) throw new AppError(400, "Phone and message required");
  const wa = whatsappManager.getInstance(req.branchId);
  const result = await wa.sendMessage(phone, message);
  const status = await wa.getStatus();
  res.json({
    success: true,
    sent: result.ok,
    queued: !result.ok && status.status !== "connected",
    message: result.ok ? "Sent" : result.error || (status.status === "connected" ? "Failed to send" : "Queued - will send when WhatsApp connects"),
  });
}));

router.post("/send-media", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const { phone, base64, filename, caption, mimetype } = req.body;
  if (!phone || !base64 || !filename) throw new AppError(400, "Phone, base64 and filename required");
  const mime = mimetype || (filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".png") ? "image/png" : filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream");
  const wa = whatsappManager.getInstance(req.branchId);
  const result = await wa.sendMedia(phone, base64, filename, mime, caption);
  const status = await wa.getStatus();
  res.json({
    success: true,
    sent: result.ok,
    queued: !result.ok && status.status !== "connected",
    message: result.ok ? "Sent" : result.error || (status.status === "connected" ? "Failed to send" : "Queued - will send when WhatsApp connects"),
  });
}));

router.post("/disconnect", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  await wa.disconnect();
  wa.init().catch(() => {});
  res.json({ success: true, message: "WhatsApp disconnected" });
}));

router.post("/pair", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const { phone } = req.body;
  if (!phone) throw new AppError(400, "Phone number required");
  const wa = whatsappManager.getInstance(req.branchId);
  const code = await wa.requestPairingCode(phone);
  res.json({ success: true, data: { pairingCode: code } });
}));

router.post("/init", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  await wa.disconnect();
  wa.init().catch(() => {});
  res.json({ success: true, message: "WhatsApp re-initialization triggered" });
}));

router.post("/broadcast", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const { numbers, message, antiban, media } = req.body;
  if (!numbers?.length) throw new AppError(400, "Numbers required");
  if (!message && !media) throw new AppError(400, "Message or media required");
  const cleanNumbers = numbers
    .map((n: string) => n.replace(/\D/g, ""))
    .filter((n: string) => n.length >= 10);
  if (!cleanNumbers.length) throw new AppError(400, "No valid phone numbers");
  const wa = whatsappManager.getInstance(req.branchId);
  const result = await wa.broadcast(cleanNumbers, message || "", antiban, media || undefined);
  res.json({ success: true, data: result });
}));

router.post("/broadcast/abort", authenticate, asyncHandler(async (req: BranchRequest, res) => {
  const wa = whatsappManager.getInstance(req.branchId);
  wa.abortBroadcast();
  res.json({ success: true, message: "Broadcast aborted" });
}));

export default router;
