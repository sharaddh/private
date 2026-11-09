import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { getWhatsAppConfig } from "../whatsapp/config";
import {
  processPendingWebhookEvents,
  recordWebhookPayload,
  verifyMetaSignature,
  verifyWebhookChallenge,
} from "../whatsapp/webhook";

export function verifyWebhook(req: Request, res: Response): void {
  const challenge = verifyWebhookChallenge(
    typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : undefined,
    typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : undefined,
    typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : undefined
  );
  if (!challenge) {
    res.status(403).type("text/plain").send("Forbidden");
    return;
  }
  res.status(200).type("text/plain").send(challenge);
}

export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  const cfg = getWhatsAppConfig();
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (rawBody.length === 0) {
    res.status(400).json({ success: false, message: "Empty webhook body" });
    return;
  }

  if (cfg.appSecret) {
    const signature = req.headers["x-hub-signature-256"];
    const header = Array.isArray(signature) ? signature[0] : signature;
    if (!verifyMetaSignature(rawBody, header, cfg.appSecret)) {
      logger.warn("Rejected WhatsApp webhook with invalid signature", { ip: req.ip });
      res.status(401).json({ success: false, message: "Invalid signature" });
      return;
    }
  } else if (cfg.provider === "meta") {
    logger.error("WhatsApp webhook rejected because META_APP_SECRET is not configured");
    res.status(503).json({ success: false, message: "Webhook verification is not configured" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ success: false, message: "Invalid JSON payload" });
    return;
  }
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ success: false, message: "Invalid webhook payload" });
    return;
  }

  try {
    const result = await recordWebhookPayload(payload);
    res.status(200).json({ success: true, received: result.received, duplicates: result.duplicates });
    setImmediate(() => {
      void processPendingWebhookEvents().catch((err) => {
        logger.error("Background WhatsApp webhook processing failed", {
          error: (err as Error).message,
        });
      });
    });
  } catch (err) {
    logger.error("Failed to persist WhatsApp webhook", { error: (err as Error).message });
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}
