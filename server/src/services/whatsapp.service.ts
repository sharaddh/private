import { normalizePhone, isValidWhatsAppPhone } from "../utils/phone";
import { Message } from "../models/message";
import { isWhatsAppConfigured, getWhatsAppConfig } from "../config/whatsapp.config";
import * as meta from "../providers/meta.provider";
import { logger } from "../utils/logger";
import type {
  WhatsAppSendResult,
  WhatsAppBroadcastResult,
  WhatsAppStatusResponse,
  WebhookBody,
} from "../types/whatsapp";

class WhatsAppService {
  private broadcastAborted = false;
  private messageQueue: Array<{ phone: string; message?: string; base64?: string; filename?: string; mimetype?: string; caption?: string; branchId: string }> = [];
  private draining = false;

  getStatus(branchId?: string): WhatsAppStatusResponse {
    if (!isWhatsAppConfigured()) {
      return { status: "error", error: "WhatsApp Cloud API not configured", queueLength: this.messageQueue.length };
    }
    const cfg = getWhatsAppConfig();
    return {
      status: "connected",
      connectedPhone: cfg.phoneNumberId,
      queueLength: this.messageQueue.length,
    };
  }

  async sendText(phone: string, message: string, branchId?: string): Promise<WhatsAppSendResult> {
    const normalized = normalizePhone(phone);
    if (!isValidWhatsAppPhone(normalized)) {
      return { success: false, sent: false, message: `Invalid phone: ${phone}` };
    }

    if (!isWhatsAppConfigured()) {
      return { success: false, sent: false, message: "WhatsApp not configured" };
    }

    try {
      const res = await meta.sendTextMessage(normalized, message);
      const metaId = res.messages?.[0]?.id || "";

      if (branchId) {
        await Message.create({
          branchId,
          phone: normalized,
          direction: "outbound",
          type: "text",
          content: message,
          metaMessageId: metaId,
          status: "sent",
        }).catch((err) => logger.warn("Failed to save message", { error: err?.message }));
      }

      logger.info("Message sent via Cloud API", { phone: normalized.slice(-4), metaId });
      return { success: true, sent: true, messageId: metaId };
    } catch (err: any) {
      const errMsg = err?.message || "Send failed";
      logger.error("sendText failed", { phone: normalized.slice(-4), error: errMsg });

      if (branchId) {
        await Message.create({
          branchId,
          phone: normalized,
          direction: "outbound",
          type: "text",
          content: message,
          status: "failed",
          error: errMsg,
        }).catch(() => {});
      }

      return { success: false, sent: false, message: errMsg };
    }
  }

  async sendMedia(
    phone: string,
    base64: string,
    filename: string,
    mimetype: string,
    caption?: string,
    branchId?: string
  ): Promise<WhatsAppSendResult> {
    const normalized = normalizePhone(phone);
    if (!isValidWhatsAppPhone(normalized)) {
      return { success: false, sent: false, message: `Invalid phone: ${phone}` };
    }

    if (!isWhatsAppConfigured()) {
      return { success: false, sent: false, message: "WhatsApp not configured" };
    }

    try {
      let res;
      const isImage = mimetype.startsWith("image/");

      if (isImage) {
        res = await meta.sendImageMessage(normalized, base64, caption);
      } else {
        res = await meta.sendDocumentMessage(normalized, base64, filename, mimetype, caption);
      }

      const metaId = res.messages?.[0]?.id || "";

      if (branchId) {
        await Message.create({
          branchId,
          phone: normalized,
          direction: "outbound",
          type: isImage ? "image" : "document",
          content: caption || "",
          filename,
          mimetype,
          metaMessageId: metaId,
          status: "sent",
        }).catch((err) => logger.warn("Failed to save message", { error: err?.message }));
      }

      logger.info("Media sent via Cloud API", { phone: normalized.slice(-4), filename, metaId });
      return { success: true, sent: true, messageId: metaId };
    } catch (err: any) {
      const errMsg = err?.message || "Media send failed";
      logger.error("sendMedia failed", { phone: normalized.slice(-4), filename, error: errMsg });

      if (branchId) {
        await Message.create({
          branchId,
          phone: normalized,
          direction: "outbound",
          type: "document",
          content: caption || "",
          filename,
          mimetype,
          status: "failed",
          error: errMsg,
        }).catch(() => {});
      }

      return { success: false, sent: false, message: errMsg };
    }
  }

  async broadcast(
    numbers: string[],
    message: string,
    branchId?: string,
    antiban?: { delayMin?: number; delayMax?: number; batchSize?: number; pause?: number },
    media?: { base64: string; filename: string; mimetype: string }
  ): Promise<WhatsAppBroadcastResult> {
    this.broadcastAborted = false;
    const delayMin = antiban?.delayMin ?? 2000;
    const delayMax = antiban?.delayMax ?? 5000;
    const batchSize = antiban?.batchSize ?? 20;
    const batchPause = antiban?.pause ?? 15000;

    let sent = 0;
    let failed = 0;
    const results: { phone: string; status: "sent" | "failed"; error?: string }[] = [];

    for (let i = 0; i < numbers.length; i++) {
      if (this.broadcastAborted) break;

      let result: WhatsAppSendResult;

      if (media) {
        const caption = media.mimetype.startsWith("image/") && message.trim() ? message : undefined;
        result = await this.sendMedia(numbers[i], media.base64, media.filename, media.mimetype, caption, branchId);

        if (result.sent && !media.mimetype.startsWith("image/") && message.trim()) {
          await new Promise((r) => setTimeout(r, 500));
          await this.sendText(numbers[i], message, branchId);
        }
      } else {
        result = await this.sendText(numbers[i], message, branchId);
      }

      if (result.sent) {
        sent++;
        results.push({ phone: numbers[i], status: "sent" });
      } else {
        failed++;
        results.push({ phone: numbers[i], status: "failed", error: result.message });
      }

      const ms = delayMin + Math.random() * (delayMax - delayMin);
      await new Promise((r) => setTimeout(r, ms));

      if ((i + 1) % batchSize === 0 && i + 1 < numbers.length) {
        const jitter = Math.random() * 5000;
        await new Promise((r) => setTimeout(r, batchPause + jitter));
      }
    }

    this.broadcastAborted = false;
    return { sent, failed, results };
  }

  abortBroadcast(): void {
    this.broadcastAborted = true;
  }

  async handleWebhook(body: WebhookBody): Promise<void> {
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        if (value.messages) {
          for (const msg of value.messages) {
            logger.info("Inbound WhatsApp message", { from: msg.from, type: msg.type });
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            const statusMap: Record<string, string> = {
              sent: "sent",
              delivered: "delivered",
              read: "read",
              played: "read",
            };
            const mappedStatus = statusMap[status.status] || status.status;

            try {
              await Message.updateOne(
                { metaMessageId: status.id },
                { $set: { status: mappedStatus } }
              );
            } catch {}

            if (status.errors && status.errors.length > 0) {
              for (const err of status.errors) {
                logger.warn("WhatsApp message delivery error", {
                  messageId: status.id,
                  code: err.code,
                  title: err.title,
                  message: err.message,
                });

                try {
                  await Message.updateOne(
                    { metaMessageId: status.id },
                    { $set: { status: "failed", error: err.message } }
                  );
                } catch {}
              }
            }
          }
        }
      }
    }
  }
}

export const whatsappService = new WhatsAppService();
