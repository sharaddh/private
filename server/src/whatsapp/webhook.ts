import { createHash, createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { getWhatsAppConfig } from "./config";
import { recordOptOutByPhone } from "./consent";
import { isOptOutKeyword, maskPhone, normalizePhone } from "./phone";
import { toSafeErrorMessage } from "./provider";

interface MetaStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: unknown }>;
}

interface MetaInboundMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
}

interface MetaChangeValue {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  statuses?: MetaStatus[];
  messages?: MetaInboundMessage[];
}

interface MetaChange {
  field?: string;
  value?: MetaChangeValue;
}

interface MetaEntry {
  id?: string;
  changes?: MetaChange[];
}

export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaEntry[];
}

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret = getWhatsAppConfig().appSecret
): boolean {
  if (!appSecret || !signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const provided = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyWebhookChallenge(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined
): string | null {
  const expected = getWhatsAppConfig().webhookVerifyToken;
  if (!expected || mode !== "subscribe" || !token || !challenge) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return challenge;
}

interface WebhookWorkItem {
  dedupeKey: string;
  eventType: string;
  payload: Record<string, unknown>;
}

function sanitizeStatus(status: MetaStatus): WebhookWorkItem | null {
  if (!status.id || !status.status) return null;
  return {
    dedupeKey: `status:${status.id}:${status.status}:${status.timestamp || "0"}`,
    eventType: "message_status",
    payload: {
      providerMessageId: status.id,
      status: status.status,
      timestamp: status.timestamp || null,
      recipientMasked: status.recipient_id ? maskPhone(`+${status.recipient_id}`) : null,
      errorCode: status.errors?.[0]?.code || null,
      errorTitle: status.errors?.[0]?.title?.slice(0, 200) || null,
    },
  };
}

function inboundText(message: MetaInboundMessage): string {
  return (
    message.text?.body ||
    message.button?.text ||
    message.interactive?.button_reply?.title ||
    message.interactive?.list_reply?.title ||
    ""
  );
}

function sanitizeInbound(message: MetaInboundMessage): WebhookWorkItem | null {
  if (!message.id || !message.from) return null;
  const text = inboundText(message);
  return {
    dedupeKey: `inbound:${message.id}`,
    eventType: "inbound_message",
    payload: {
      providerMessageId: message.id,
      fromMasked: maskPhone(`+${message.from}`),
      fromDigits: message.from,
      type: message.type || "unknown",
      optedOut: isOptOutKeyword(text),
      timestamp: message.timestamp || null,
    },
  };
}

export function flattenWebhookPayload(payload: MetaWebhookPayload): WebhookWorkItem[] {
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return [];
  }
  const items: WebhookWorkItem[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value) continue;
      for (const status of value.statuses || []) {
        const item = sanitizeStatus(status);
        if (item) items.push(item);
      }
      for (const message of value.messages || []) {
        const item = sanitizeInbound(message);
        if (item) items.push(item);
      }
    }
  }
  return items;
}

export async function recordWebhookPayload(payload: MetaWebhookPayload) {
  const items = flattenWebhookPayload(payload);
  let duplicates = 0;
  for (const item of items) {
    try {
      await prisma.whatsAppWebhookEvent.create({
        data: {
          dedupeKey: item.dedupeKey,
          eventType: item.eventType,
          payload: item.payload as Prisma.InputJsonValue,
          status: "pending",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        duplicates += 1;
      } else {
        throw err;
      }
    }
  }
  return { received: items.length, duplicates };
}

function statusRank(status: string | null | undefined): number {
  return (
    {
      submitting: 0,
      submitted: 1,
      sent: 2,
      delivered: 3,
      read: 4,
    } as Record<string, number>
  )[status || ""] ?? -1;
}

async function applyStatus(payload: Record<string, unknown>) {
  const providerMessageId = String(payload.providerMessageId || "");
  const status = String(payload.status || "").toLowerCase();
  if (!providerMessageId || !status) return false;

  const timestamp = payload.timestamp ? Number(payload.timestamp) * 1000 : Date.now();
  const at = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
  const message = await prisma.whatsAppMessage.findUnique({ where: { providerMessageId } });
  if (!message) return false;

  const update: Prisma.WhatsAppMessageUpdateInput = { providerStatus: status };

  if (status === "sent") {
    update.sentAt = at;
    if (statusRank(message.status) < statusRank("sent")) update.status = "sent";
  } else if (status === "delivered") {
    update.sentAt = message.sentAt || at;
    update.deliveredAt = at;
    if (statusRank(message.status) < statusRank("delivered")) update.status = "delivered";
  } else if (status === "read") {
    update.sentAt = message.sentAt || at;
    update.deliveredAt = message.deliveredAt || at;
    update.readAt = at;
    if (statusRank(message.status) < statusRank("read")) update.status = "read";
  } else if (status === "failed") {
    update.status = "failed";
    update.failedAt = at;
    update.errorCode = payload.errorCode ? String(payload.errorCode) : "provider_failed";
    update.errorMessageSafe =
      String(payload.errorTitle || "Message failed at provider").slice(0, 300);
  }

  const recipientUpdate: Prisma.WhatsAppCampaignRecipientUpdateManyMutationInput = {};
  if (status === "delivered") {
    recipientUpdate.deliveredAt = at;
  } else if (status === "read") {
    recipientUpdate.readAt = at;
  } else if (status === "failed") {
    recipientUpdate.status = "failed";
    recipientUpdate.failedAt = at;
    recipientUpdate.errorCode = payload.errorCode ? String(payload.errorCode) : "provider_failed";
    recipientUpdate.errorMessageSafe = String(payload.errorTitle || "Message failed").slice(0, 300);
  }

  await prisma.$transaction([
    prisma.whatsAppMessage.update({ where: { id: message.id }, data: update }),
    ...(Object.keys(recipientUpdate).length > 0
      ? [
          prisma.whatsAppCampaignRecipient.updateMany({
            where: { providerMessageId, status: { not: "failed" } },
            data: recipientUpdate,
          }),
        ]
      : []),
  ]);
  return true;
}

async function applyInbound(payload: Record<string, unknown>) {
  const providerMessageId = String(payload.providerMessageId || "");
  const fromDigits = String(payload.fromDigits || "");
  if (!providerMessageId || !fromDigits) return false;
  const normalized = normalizePhone(`+${fromDigits}`);
  if (!normalized.e164) return false;

  if (payload.optedOut === true) {
    await recordOptOutByPhone(
      normalized.e164,
      "whatsapp_inbound",
      "Inbound stop keyword received"
    );
  }

  const recent = await prisma.whatsAppMessage.findFirst({
    where: { phoneE164: normalized.e164 },
    orderBy: { createdAt: "desc" },
    select: { branchId: true, customerId: true },
  });
  if (!recent) return payload.optedOut === true;

  try {
    await prisma.whatsAppMessage.create({
      data: {
        branchId: recent.branchId,
        customerId: recent.customerId,
        direction: "inbound",
        messageType: String(payload.type || "text"),
        phoneE164: normalized.e164,
        providerMessageId,
        providerStatus: "received",
        status: "received",
        idempotencyKey: `inbound:${providerMessageId}`,
        contentPreview:
          payload.optedOut === true ? "Inbound opt-out keyword" : "Inbound message (content not stored)",
        submittedAt: payload.timestamp ? new Date(Number(payload.timestamp) * 1000) : new Date(),
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  return true;
}

export async function processWebhookEvent(eventId: string): Promise<void> {
  const event = await prisma.whatsAppWebhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status !== "processing") return;
  const payload = (event.payload || {}) as Record<string, unknown>;
  try {
    let handled = false;
    if (event.eventType === "message_status") handled = await applyStatus(payload);
    else if (event.eventType === "inbound_message") handled = await applyInbound(payload);
    await prisma.whatsAppWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: handled ? "processed" : "ignored",
        processedAt: new Date(),
        error: handled ? null : "No matching local record",
      },
    });
  } catch (err) {
    await prisma.whatsAppWebhookEvent.update({
      where: { id: eventId },
      data: { status: "failed", error: toSafeErrorMessage(err), processedAt: new Date() },
    });
    logger.error("WhatsApp webhook event processing failed", {
      eventId,
      eventType: event.eventType,
      error: (err as Error).message,
    });
  }
}

export async function processPendingWebhookEvents(limit = 50): Promise<number> {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.whatsAppWebhookEvent.updateMany({
    where: { status: "processing", updatedAt: { lt: staleBefore } },
    data: { status: "pending" },
  });
  const pending = await prisma.whatsAppWebhookEvent.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const event of pending) {
    const claimed = await prisma.whatsAppWebhookEvent.updateMany({
      where: { id: event.id, status: "pending" },
      data: { status: "processing" },
    });
    if (claimed.count !== 1) continue;
    await processWebhookEvent(event.id);
    processed += 1;
  }
  return processed;
}

export function payloadFingerprint(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
