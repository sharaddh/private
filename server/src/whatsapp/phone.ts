import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { getWhatsAppConfig } from "./config";

const CALLING_CODE_TO_REGION: Record<string, CountryCode> = {
  "1": "US",
  "44": "GB",
  "61": "AU",
  "65": "SG",
  "91": "IN",
  "92": "PK",
  "977": "NP",
  "971": "AE",
  "880": "BD",
};

export interface NormalizedPhone {
  e164: string | null;
  country: string | null;
  valid: boolean;
  reason?: "missing" | "unparseable" | "invalid";
}

function defaultRegion(): CountryCode | undefined {
  const code = getWhatsAppConfig().defaultCountryCode;
  return CALLING_CODE_TO_REGION[code];
}

export function normalizePhone(raw: string | null | undefined): NormalizedPhone {
  const value = String(raw || "").trim();
  if (!value) return { e164: null, country: null, valid: false, reason: "missing" };

  const defaultCode = getWhatsAppConfig().defaultCountryCode;
  const region = defaultRegion();
  let candidate = value.replace(/[^\d+]/g, "");

  if (!candidate) return { e164: null, country: null, valid: false, reason: "missing" };

  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  } else if (!candidate.startsWith("+")) {
    const digits = candidate.replace(/\D/g, "");
    if (defaultCode && digits.startsWith(defaultCode) && digits.length > defaultCode.length + 6) {
      candidate = `+${digits}`;
    } else if (digits.startsWith("0") && region) {
      candidate = `+${defaultCode}${digits.replace(/^0+/, "")}`;
    }
  }

  let parsed = parsePhoneNumberFromString(candidate, region);
  if (!parsed && !candidate.startsWith("+") && defaultCode) {
    parsed = parsePhoneNumberFromString(`+${defaultCode}${candidate.replace(/^0+/, "")}`);
  }

  if (!parsed) return { e164: null, country: null, valid: false, reason: "unparseable" };
  if (!parsed.isValid()) return { e164: null, country: parsed.country || null, valid: false, reason: "invalid" };

  return {
    e164: parsed.number,
    country: parsed.country || null,
    valid: true,
  };
}

export function normalizeToE164(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw);
  return normalized.valid ? normalized.e164 : null;
}

export function maskPhone(phone: string | null | undefined): string {
  const value = String(phone || "").trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return `****${digits}`;
  const prefix = value.startsWith("+") ? `+${digits.slice(0, Math.max(1, digits.length - 10))}` : "";
  return `${prefix}******${digits.slice(-4)}`;
}

const DEFAULT_OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "opt out",
  "optout",
  "do not message",
  "don't message",
  "cancel",
  "band karo",
  "mat bhejo",
  "nahi chahiye",
  "रोको",
  "बंद करो",
];

export function getOptOutKeywords(): string[] {
  const configured = (process.env.WHATSAPP_OPT_OUT_KEYWORDS || "")
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_OPT_OUT_KEYWORDS;
}

export function isOptOutKeyword(text: string | null | undefined): boolean {
  const normalized = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return getOptOutKeywords().some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `));
}
