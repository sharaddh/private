import { Request, Response, NextFunction } from "express";
import { verifyWebhookSignature } from "../providers/meta.provider";
import { getWhatsAppConfig } from "../config/whatsapp.config";
import { logger } from "../utils/logger";

export function verifyWebhook(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as any).rawBody;

  if (rawBody && signature) {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    if (!verifyWebhookSignature(bodyBuffer, signature)) {
      logger.warn("Webhook signature verification failed");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  next();
}

export function handleWebhookVerification(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === getWhatsAppConfig().verifyToken) {
    logger.info("Webhook verified successfully");
    res.status(200).send(challenge);
    return;
  }

  logger.warn("Webhook verification failed", { mode, token });
  res.status(403).json({ error: "Forbidden" });
}
