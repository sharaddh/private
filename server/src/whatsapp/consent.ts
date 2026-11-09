import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import { maskPhone, normalizePhone } from "./phone";
import type { ConsentCategory, ConsentStatus } from "./types";

export interface ConsentActor {
  id?: string;
  name?: string;
}

export interface ConsentUpdate {
  consentStatus: ConsentStatus;
  transactionalConsent: boolean;
  marketingConsent: boolean;
  source?: string;
  evidence?: string;
}

export function deriveConsentStatus(
  status: ConsentStatus,
  transactional: boolean,
  marketing: boolean
): ConsentStatus {
  if (status === "opted_out") return "opted_out";
  if (transactional || marketing) return "opted_in";
  return status === "opted_in" ? "opted_in" : "unknown";
}

async function findCustomer(branchId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId },
    select: { id: true, name: true, mobile: true, branchId: true },
  });
  if (!customer) throw new AppError(404, "Customer not found");
  return customer;
}

export async function ensurePreference(branchId: string, customerId: string) {
  const customer = await findCustomer(branchId, customerId);
  const normalized = normalizePhone(customer.mobile);
  const existing = await prisma.whatsAppPreference.findUnique({ where: { customerId } });

  if (!existing) {
    return prisma.whatsAppPreference.create({
      data: {
        branchId,
        customerId,
        phoneE164: normalized.e164,
        phoneCountry: normalized.country,
        phoneValidationStatus: normalized.valid
          ? "valid"
          : normalized.reason === "invalid"
            ? "invalid"
            : "unknown",
      },
    });
  }

  const phoneChanged =
    existing.phoneE164 !== normalized.e164 ||
    existing.phoneValidationStatus !==
      (normalized.valid ? "valid" : normalized.reason === "invalid" ? "invalid" : "unknown");
  if (!phoneChanged) return existing;

  return prisma.whatsAppPreference.update({
    where: { id: existing.id },
    data: {
      phoneE164: normalized.e164,
      phoneCountry: normalized.country,
      phoneValidationStatus: normalized.valid
        ? "valid"
        : normalized.reason === "invalid"
          ? "invalid"
          : "unknown",
    },
  });
}

export async function updateConsent(
  branchId: string,
  customerId: string,
  update: ConsentUpdate,
  actor: ConsentActor = {}
) {
  const before = await ensurePreference(branchId, customerId);
  const optedOut = update.consentStatus === "opted_out";
  const transactional = optedOut ? false : Boolean(update.transactionalConsent);
  const marketing = optedOut ? false : Boolean(update.marketingConsent);
  const consentStatus = deriveConsentStatus(update.consentStatus, transactional, marketing);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const preference = await tx.whatsAppPreference.update({
      where: { id: before.id },
      data: {
        consentStatus,
        transactionalConsent: transactional,
        marketingConsent: marketing,
        consentSource: update.source || "admin",
        consentCapturedAt: now,
        consentEvidence: update.evidence,
        optedOutAt: optedOut ? now : null,
        lastConsentUpdatedAt: now,
      },
    });

    await tx.whatsAppConsentAudit.create({
      data: {
        branchId,
        customerId,
        action: optedOut ? "opt_out" : "update",
        fromStatus: before.consentStatus,
        toStatus: consentStatus,
        source: update.source || "admin",
        evidence: update.evidence,
        actorId: actor.id,
        actorName: actor.name,
      },
    });

    return preference;
  });
}

export async function recordOptOutByPhone(
  phoneE164: string,
  source: string,
  evidence?: string
): Promise<number> {
  const matches = await prisma.whatsAppPreference.findMany({
    where: { phoneE164 },
    select: { id: true, branchId: true, customerId: true, consentStatus: true },
  });
  if (matches.length === 0) return 0;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const preference of matches) {
      await tx.whatsAppPreference.update({
        where: { id: preference.id },
        data: {
          consentStatus: "opted_out",
          transactionalConsent: false,
          marketingConsent: false,
          optedOutAt: now,
          lastConsentUpdatedAt: now,
          consentSource: source,
          consentEvidence: evidence,
        },
      });
      await tx.whatsAppConsentAudit.create({
        data: {
          branchId: preference.branchId,
          customerId: preference.customerId,
          action: "opt_out",
          fromStatus: preference.consentStatus,
          toStatus: "opted_out",
          source,
          evidence,
        },
      });
    }
  });

  return matches.length;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  phoneE164?: string;
  customerName?: string;
}

export async function checkEligibility(
  branchId: string,
  customerId: string,
  category: ConsentCategory
): Promise<EligibilityResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId },
    select: { name: true },
  });
  if (!customer) return { eligible: false, reason: "customer_not_found" };

  const preference = await ensurePreference(branchId, customerId);
  if (preference.consentStatus === "opted_out") {
    return { eligible: false, reason: "opted_out", phoneE164: preference.phoneE164 || undefined };
  }
  if (preference.phoneValidationStatus !== "valid" || !preference.phoneE164) {
    return { eligible: false, reason: "invalid_phone" };
  }
  if (category === "marketing") {
    if (preference.consentStatus !== "opted_in" || !preference.marketingConsent) {
      return {
        eligible: false,
        reason: "marketing_consent_missing",
        phoneE164: preference.phoneE164,
        customerName: customer.name,
      };
    }
  } else if (!preference.transactionalConsent) {
    return {
      eligible: false,
      reason: "transactional_consent_missing",
      phoneE164: preference.phoneE164,
      customerName: customer.name,
    };
  }

  return {
    eligible: true,
    phoneE164: preference.phoneE164,
    customerName: customer.name,
  };
}

export async function getCustomerPreferenceView(branchId: string, customerId: string) {
  const customer = await findCustomer(branchId, customerId);
  const preference = await ensurePreference(branchId, customerId);
  const audits = await prisma.whatsAppConsentAudit.findMany({
    where: { branchId, customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    customer: { id: customer.id, name: customer.name, mobile: customer.mobile },
    preference: {
      ...preference,
      phoneE164Masked: maskPhone(preference.phoneE164),
    },
    audits,
  };
}

interface AuditCustomerRow {
  id: string;
  name: string;
  mobile: string | null;
  createdAt: Date;
  whatsappPreference: {
    phoneE164: string | null;
    phoneValidationStatus: string;
    consentStatus: string;
    transactionalConsent: boolean;
    marketingConsent: boolean;
  } | null;
}

export async function getConsentAudit(branchId: string) {
  const customers = (await prisma.customer.findMany({
    where: { branchId },
    select: {
      id: true,
      name: true,
      mobile: true,
      createdAt: true,
      whatsappPreference: {
        select: {
          phoneE164: true,
          phoneValidationStatus: true,
          consentStatus: true,
          transactionalConsent: true,
          marketingConsent: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as AuditCustomerRow[];

  const normalized = new Map<string, string[]>();
  let hasPhone = 0;
  let validPhone = 0;
  let invalidOrMissing = 0;
  let marketingOptedIn = 0;
  let transactionalOptedIn = 0;
  let unknownConsent = 0;
  let optedOut = 0;

  for (const customer of customers) {
    const pref = customer.whatsappPreference;
    const phone = pref?.phoneE164 || normalizePhone(customer.mobile).e164;
    const validation =
      pref?.phoneValidationStatus || (normalizePhone(customer.mobile).valid ? "valid" : "invalid");
    if (customer.mobile || pref?.phoneE164) hasPhone += 1;
    if (phone && validation === "valid") {
      validPhone += 1;
      normalized.set(phone, [...(normalized.get(phone) || []), customer.id]);
    } else {
      invalidOrMissing += 1;
    }
    if (pref?.marketingConsent) marketingOptedIn += 1;
    if (pref?.transactionalConsent) transactionalOptedIn += 1;
    if (!pref || pref.consentStatus === "unknown") unknownConsent += 1;
    if (pref?.consentStatus === "opted_out") optedOut += 1;
  }

  let eligibleMarketing = 0;
  let eligibleTransactional = 0;
  for (const customer of customers) {
    const pref = customer.whatsappPreference;
    const phone = pref?.phoneE164 || normalizePhone(customer.mobile).e164;
    if (!phone || normalized.get(phone)?.length !== 1) continue;
    if (
      pref?.consentStatus === "opted_in" &&
      pref.marketingConsent &&
      pref.phoneValidationStatus === "valid"
    ) {
      eligibleMarketing += 1;
    }
    if (
      pref?.transactionalConsent &&
      pref.consentStatus !== "opted_out" &&
      pref.phoneValidationStatus === "valid"
    ) {
      eligibleTransactional += 1;
    }
  }

  const allDuplicateGroups = [...normalized.entries()].filter(([, ids]) => ids.length > 1);
  const duplicateGroups = allDuplicateGroups
    .map(([phone, ids]) => ({ phoneMasked: maskPhone(phone), count: ids.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return {
    totalCustomers: customers.length,
    hasPhone,
    validPhone,
    invalidOrMissingPhone: invalidOrMissing,
    duplicatePhoneGroups: allDuplicateGroups.length,
    duplicateCustomers: allDuplicateGroups.reduce((sum, [, ids]) => sum + ids.length, 0),
    marketingOptedIn,
    transactionalOptedIn,
    unknownConsent,
    optedOut,
    eligibleMarketing,
    eligibleTransactional,
    duplicates: duplicateGroups,
  };
}
