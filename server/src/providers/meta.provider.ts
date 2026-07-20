import { getWhatsAppConfig, isWhatsAppConfigured } from "../config/whatsapp.config";
import { logger } from "../utils/logger";
import type { MetaSendMessageResponse, MetaSendError } from "../types/whatsapp";

const META_BASE_URL = "https://graph.facebook.com";

async function metaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cfg = getWhatsAppConfig();
  const url = `${META_BASE_URL}/${cfg.apiVersion}/${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await res.json();

  if (!res.ok) {
    const err = body as MetaSendError;
    const msg = err?.error?.message || `Meta API ${res.status}`;
    logger.error("Meta API error", { status: res.status, message: msg, path });
    throw new Error(msg);
  }

  return body as T;
}

export async function sendTextMessage(phone: string, text: string): Promise<MetaSendMessageResponse> {
  const cfg = getWhatsAppConfig();
  logger.info("Meta: sending text message", { phone: phone.slice(-4), phoneNumberId: cfg.phoneNumberId });

  return metaFetch<MetaSendMessageResponse>(`${cfg.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
}

export async function sendDocumentMessage(
  phone: string,
  base64: string,
  filename: string,
  mimetype: string,
  caption?: string
): Promise<MetaSendMessageResponse> {
  const cfg = getWhatsAppConfig();
  logger.info("Meta: sending document", { phone: phone.slice(-4), filename, mimetype });

  const mediaId = await uploadMedia(base64, mimetype);

  const message: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "document",
    document: {
      id: mediaId,
      filename,
      caption: caption || "",
    },
  };

  return metaFetch<MetaSendMessageResponse>(`${cfg.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

export async function sendImageMessage(
  phone: string,
  base64: string,
  caption?: string
): Promise<MetaSendMessageResponse> {
  const cfg = getWhatsAppConfig();
  logger.info("Meta: sending image", { phone: phone.slice(-4) });

  const mediaId = await uploadMedia(base64, "image/jpeg");

  return metaFetch<MetaSendMessageResponse>(`${cfg.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "image",
      image: {
        id: mediaId,
        caption: caption || "",
      },
    }),
  });
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  params?: Array<{ type: string; text: string }>
): Promise<MetaSendMessageResponse> {
  const cfg = getWhatsAppConfig();
  logger.info("Meta: sending template", { phone: phone.slice(-4), template: templateName });

  const components: Record<string, unknown>[] = [];
  if (params && params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((p) => ({ type: p.type, text: p.text })),
    });
  }

  return metaFetch<MetaSendMessageResponse>(`${cfg.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    }),
  });
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const cfg = getWhatsAppConfig();
  try {
    await metaFetch(`${cfg.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (err: any) {
    logger.warn("Meta: mark read failed", { error: err?.message });
  }
}

export async function uploadMedia(base64: string, mimetype: string): Promise<string> {
  const cfg = getWhatsAppConfig();
  const buffer = Buffer.from(base64, "base64");

  const res = await fetch(
    `${META_BASE_URL}/${cfg.apiVersion}/${cfg.phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: (() => {
        const form = new FormData();
        const blob = new Blob([buffer], { type: mimetype });
        form.append("file", blob);
        form.append("messaging_product", "whatsapp");
        form.append("type", mimetype);
        return form;
      })(),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    const errMsg = (body as MetaSendError)?.error?.message || `Upload failed ${res.status}`;
    logger.error("Meta: media upload failed", { error: errMsg });
    throw new Error(errMsg);
  }

  return (body as { id: string }).id;
}

export async function getPhoneNumberInfo(): Promise<{ display_phone_number: string; phone_number_id: string } | null> {
  if (!isWhatsAppConfigured()) return null;
  const cfg = getWhatsAppConfig();
  try {
    const res = await metaFetch<{ display_phone_number: string; phone_number_id: string }>(
      `${cfg.phoneNumberId}`
    );
    return res;
  } catch {
    return null;
  }
}

export function verifyWebhookSignature(
  body: string | Buffer,
  signature: string | undefined
): boolean {
  if (!signature) return false;
  const cfg = getWhatsAppConfig();
  if (!cfg.appSecret) return true;

  const crypto = require("crypto") as typeof import("crypto");
  const hmac = crypto.createHmac("sha256", cfg.appSecret);
  const rawBody = typeof body === "string" ? body : body.toString("utf-8");
  hmac.update(rawBody);
  const expected = `sha256=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
