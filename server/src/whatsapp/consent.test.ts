import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customerFindFirst: vi.fn(),
  preferenceFindUnique: vi.fn(),
  preferenceCreate: vi.fn(),
  preferenceUpdate: vi.fn(),
}));

vi.mock("../db/prisma", () => ({
  prisma: {
    customer: { findFirst: mocks.customerFindFirst },
    whatsAppPreference: {
      findUnique: mocks.preferenceFindUnique,
      create: mocks.preferenceCreate,
      update: mocks.preferenceUpdate,
    },
  },
}));

import { checkEligibility, deriveConsentStatus } from "./consent";

const branchId = "branch-1";
const customerId = "customer-1";

function preference(overrides: Record<string, unknown> = {}) {
  return {
    id: "preference-1",
    branchId,
    customerId,
    phoneE164: "+919876543210",
    phoneCountry: "IN",
    phoneValidationStatus: "valid",
    consentStatus: "opted_in",
    transactionalConsent: true,
    marketingConsent: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customerFindFirst.mockResolvedValue({
    id: customerId,
    name: "Asha",
    mobile: "9876543210",
    branchId,
  });
  mocks.preferenceFindUnique.mockResolvedValue(preference());
});

describe("deriveConsentStatus", () => {
  it("keeps opted-out status regardless of category flags", () => {
    expect(deriveConsentStatus("opted_out", true, true)).toBe("opted_out");
  });

  it("becomes opted-in when any category consent is true", () => {
    expect(deriveConsentStatus("unknown", true, false)).toBe("opted_in");
    expect(deriveConsentStatus("unknown", false, true)).toBe("opted_in");
  });

  it("keeps an existing opt-in and otherwise reports unknown", () => {
    expect(deriveConsentStatus("opted_in", false, false)).toBe("opted_in");
    expect(deriveConsentStatus("unknown", false, false)).toBe("unknown");
  });
});

describe("checkEligibility", () => {
  it("allows a transactional message with phone and consent", async () => {
    await expect(checkEligibility(branchId, customerId, "transactional")).resolves.toEqual({
      eligible: true,
      phoneE164: "+919876543210",
      customerName: "Asha",
    });
  });

  it("rejects an opted-out customer for every category", async () => {
    mocks.preferenceFindUnique.mockResolvedValue(preference({ consentStatus: "opted_out" }));

    const transactional = await checkEligibility(branchId, customerId, "transactional");
    const marketing = await checkEligibility(branchId, customerId, "marketing");

    expect(transactional).toMatchObject({ eligible: false, reason: "opted_out" });
    expect(marketing).toMatchObject({ eligible: false, reason: "opted_out" });
  });

  it("requires marketing consent for marketing messages", async () => {
    await expect(checkEligibility(branchId, customerId, "marketing")).resolves.toMatchObject({
      eligible: false,
      reason: "marketing_consent_missing",
    });
  });

  it("allows marketing when explicit marketing consent exists", async () => {
    mocks.preferenceFindUnique.mockResolvedValue(preference({ marketingConsent: true }));

    await expect(checkEligibility(branchId, customerId, "marketing")).resolves.toMatchObject({
      eligible: true,
      phoneE164: "+919876543210",
    });
  });

  it("requires transactional consent for transactional messages", async () => {
    mocks.preferenceFindUnique.mockResolvedValue(preference({ transactionalConsent: false }));

    await expect(checkEligibility(branchId, customerId, "transactional")).resolves.toMatchObject({
      eligible: false,
      reason: "transactional_consent_missing",
    });
  });

  it("rejects invalid phone numbers", async () => {
    const invalid = preference({ phoneE164: null, phoneValidationStatus: "invalid" });
    mocks.preferenceFindUnique.mockResolvedValue(invalid);
    mocks.preferenceUpdate.mockResolvedValue(invalid);

    await expect(checkEligibility(branchId, customerId, "transactional")).resolves.toMatchObject({
      eligible: false,
      reason: "invalid_phone",
    });
  });

  it("rejects customers outside the branch", async () => {
    mocks.customerFindFirst.mockResolvedValue(null);

    await expect(checkEligibility(branchId, customerId, "transactional")).resolves.toEqual({
      eligible: false,
      reason: "customer_not_found",
    });
  });
});
