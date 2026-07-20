import { Request, Response } from "express";
import { whatsappService } from "../services/whatsapp.service";
import { handleWebhookVerification } from "../middleware/verifyWebhook";
import type { BranchRequest } from "../middleware/branch";
import type { WebhookBody } from "../types/whatsapp";

export async function getStatus(req: Request, res: Response): Promise<void> {
  const branchReq = req as BranchRequest;
  const status = whatsappService.getStatus(branchReq.branchId);
  res.json({ success: true, data: status });
}

export async function sendText(req: Request, res: Response): Promise<void> {
  const branchReq = req as BranchRequest;
  const { phone, message } = req.body;
  const result = await whatsappService.sendText(phone, message, branchReq.branchId);
  res.json({ success: result.success, data: result, message: result.message });
}

export async function sendMedia(req: Request, res: Response): Promise<void> {
  const branchReq = req as BranchRequest;
  const { phone, base64, filename, caption, mimetype } = req.body;
  const result = await whatsappService.sendMedia(
    phone,
    base64,
    filename,
    mimetype || "application/pdf",
    caption,
    branchReq.branchId
  );
  res.json({ success: result.success, data: result, message: result.message });
}

export async function broadcast(req: Request, res: Response): Promise<void> {
  const branchReq = req as BranchRequest;
  const { numbers, message, antiban, media } = req.body;

  whatsappService.broadcast(numbers, message, branchReq.branchId, antiban, media).then((result) => {
    // Fire-and-forget; client can poll or we could emit via SSE
  });

  res.json({ success: true, message: "Broadcast started" });
}

export async function abortBroadcast(_req: Request, res: Response): Promise<void> {
  whatsappService.abortBroadcast();
  res.json({ success: true, message: "Broadcast abort requested" });
}

export function webhookVerify(req: Request, res: Response): void {
  handleWebhookVerification(req, res);
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as WebhookBody;
  await whatsappService.handleWebhook(body);
  res.status(200).json({ status: "ok" });
}
