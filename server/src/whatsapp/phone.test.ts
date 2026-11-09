import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isOptOutKeyword, maskPhone, normalizePhone, normalizeToE164 } from "./phone";

const originalCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE;
const originalKeywords = process.env.WHATSAPP_OPT_OUT_KEYWORDS;

beforeEach(() => {
  process.env.WHATSAPP_DEFAULT_COUNTRY_CODE = "91";
  delete process.env.WHATSAPP_OPT_OUT_KEYWORDS;
});

afterEach(() => {
  if (originalCountryCode === undefined) delete process.env.WHATSAPP_DEFAULT_COUNTRY_CODE;
  else process.env.WHATSAPP_DEFAULT_COUNTRY_CODE = originalCountryCode;
  if (originalKeywords === undefined) delete process.env.WHATSAPP_OPT_OUT_KEYWORDS;
  else process.env.WHATSAPP_OPT_OUT_KEYWORDS = originalKeywords;
});

describe("normalizePhone", () => {
  it("normalizes an international Indian number", () => {
    const result = normalizePhone("+91 98765 43210");
    expect(result).toEqual({ e164: "+919876543210", country: "IN", valid: true });
  });

  it("adds the default country code to a local number", () => {
    expect(normalizeToE164("9876543210")).toBe("+919876543210");
  });

  it("normalizes a local number with a trunk zero", () => {
    expect(normalizeToE164("09876543210")).toBe("+919876543210");
  });

  it("normalizes an international 00 prefix", () => {
    expect(normalizeToE164("00919876543210")).toBe("+919876543210");
  });

  it("rejects short or unusable input", () => {
    const short = normalizePhone("12345");
    expect(short.valid).toBe(false);
    expect(short.e164).toBeNull();

    const text = normalizePhone("not a number");
    expect(text.valid).toBe(false);
    expect(text.reason).toBe("missing");
  });

  it("reports missing values distinctly", () => {
    expect(normalizePhone("")).toEqual({
      e164: null,
      country: null,
      valid: false,
      reason: "missing",
    });
    expect(normalizePhone(null).reason).toBe("missing");
  });
});

describe("maskPhone", () => {
  it("keeps only the country prefix and last four digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91******3210");
  });

  it("masks short values without exposing the whole number", () => {
    expect(maskPhone("1234")).toBe("****1234");
    expect(maskPhone("")).toBe("");
  });
});

describe("isOptOutKeyword", () => {
  it("matches common English and Hindi opt-out words", () => {
    expect(isOptOutKeyword("STOP")).toBe(true);
    expect(isOptOutKeyword("stop messaging me")).toBe(true);
    expect(isOptOutKeyword("Stop!")).toBe(true);
    expect(isOptOutKeyword("band karo")).toBe(true);
    expect(isOptOutKeyword("रोको")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(isOptOutKeyword("please stop by the store")).toBe(false);
    expect(isOptOutKeyword("cancelled order")).toBe(false);
    expect(isOptOutKeyword("")).toBe(false);
  });

  it("honors configured keyword overrides", () => {
    process.env.WHATSAPP_OPT_OUT_KEYWORDS = "halt,no thanks";
    expect(isOptOutKeyword("halt")).toBe(true);
    expect(isOptOutKeyword("STOP")).toBe(false);
  });
});
