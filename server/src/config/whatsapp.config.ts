import type { WhatsAppConfig } from "../types/whatsapp";

let cached: WhatsAppConfig | null = null;

export function getWhatsAppConfig(): WhatsAppConfig {
  if (cached) return cached;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";

  cached = { accessToken, phoneNumberId, businessAccountId, apiVersion, verifyToken, appSecret };
  return cached;
}

export function isWhatsAppConfigured(): boolean {
  const cfg = getWhatsAppConfig();
  return !!(cfg.accessToken && cfg.phoneNumberId);
}

export function resetWhatsAppConfig(): void {
  cached = null;
}
