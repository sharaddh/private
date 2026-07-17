import { Request, Response } from "express";
import { whatsappManager } from "../services/whatsapp";
import { sendSuccess, sendError } from "../utils/response";

function getInstance(branchId?: string) {
  return whatsappManager.getInstance(branchId);
}

export async function getStatus(req: Request, res: Response) {
  const { branchId } = req.query;
  const wa = getInstance(branchId as string);
  const data = await wa.getStatus();
  sendSuccess(res, data);
}

export async function sendMessage(req: Request, res: Response) {
  const { phone, message, branchId } = req.body;
  const wa = getInstance(branchId);
  const result = await wa.sendMessage(phone, message);
  if (!result.ok) {
    sendError(res, result.error || "Failed to send message", 502);
    return;
  }
  sendSuccess(res, result, "Message sent");
}

export async function sendMedia(req: Request, res: Response) {
  const { phone, base64, filename, mimetype, caption, branchId } = req.body;
  const wa = getInstance(branchId);
  const result = await wa.sendMedia(phone, base64, filename, mimetype, caption);
  if (!result.ok) {
    sendError(res, result.error || "Failed to send media", 502);
    return;
  }
  sendSuccess(res, result, "Media sent");
}

export async function broadcast(req: Request, res: Response) {
  const { numbers, message, antiban, media, branchId } = req.body;
  const wa = getInstance(branchId);
  const data = await wa.broadcast(numbers, message, antiban, media);
  sendSuccess(res, data, `Broadcast complete: ${data.sent} sent, ${data.failed} failed`);
}

export async function abortBroadcast(req: Request, res: Response) {
  const { branchId } = req.body;
  const wa = getInstance(branchId);
  wa.abortBroadcast();
  sendSuccess(res, null, "Broadcast aborted");
}

export async function requestPairingCode(req: Request, res: Response) {
  const { phoneNumber, branchId } = req.body;
  const wa = getInstance(branchId);
  const code = await wa.requestPairingCode(phoneNumber);
  sendSuccess(res, { pairingCode: code }, "Pairing code generated");
}

export async function disconnect(req: Request, res: Response) {
  const { branchId } = req.body;
  const wa = getInstance(branchId);
  await wa.disconnect();
  sendSuccess(res, null, "WhatsApp disconnected");
}

export async function reconnect(req: Request, res: Response) {
  const { branchId } = req.body;
  const wa = getInstance(branchId);
  await wa.reconnect();
  sendSuccess(res, null, "WhatsApp reconnecting");
}
