import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { getSendGate } from "./settings";
import { maskPhone, normalizePhone } from "./phone";
import { getWhatsAppProvider } from "./provider-factory";
import { WhatsAppProviderError, toSafeErrorMessage } from "./provider";
import { getApprovedTemplateForEvent, parseParameterMap, renderTemplatePreview } from "./templates";
import { getWhatsAppConfig } from "./config";
import { backoffDelayMs } from "./outbox";

export interface AudienceFilter {
  createdFrom?: string;
  createdTo?: string;
  tags?: string[];
  city?: string;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  hasPending?: boolean;
  inactiveDays?: number;
}

interface AudienceCandidate {
  id: string;
  name: string;
  mobile: string | null;
  city: string | null;
  totalSpent: number;
  pendingAmount: number;
  tags: string[];
  createdAt: Date;
  lastOrderAt: Date | null;
  preference: {
    phoneE164: string | null;
    phoneValidationStatus: string;
    consentStatus: string;
    transactionalConsent: boolean;
    marketingConsent: boolean;
  } | null;
}

function parseAudienceFilter(value: unknown): AudienceFilter {
  if (!value || typeof value !== "object") return {};
  const filter = value as Record<string, unknown>;
  const tags = Array.isArray(filter.tags)
    ? filter.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : undefined;
  return {
    createdFrom: filter.createdFrom ? String(filter.createdFrom) : undefined,
    createdTo: filter.createdTo ? String(filter.createdTo) : undefined,
    tags,
    city: filter.city ? String(filter.city).trim() : undefined,
    minTotalSpent:
      filter.minTotalSpent !== undefined && filter.minTotalSpent !== ""
        ? Number(filter.minTotalSpent)
        : undefined,
    maxTotalSpent:
      filter.maxTotalSpent !== undefined && filter.maxTotalSpent !== ""
        ? Number(filter.maxTotalSpent)
        : undefined,
    hasPending: typeof filter.hasPending === "boolean" ? filter.hasPending : undefined,
    inactiveDays:
      filter.inactiveDays !== undefined && filter.inactiveDays !== ""
        ? Number(filter.inactiveDays)
        : undefined,
  };
}

function buildCustomerWhere(branchId: string, filter: AudienceFilter): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { branchId };
  if (filter.createdFrom || filter.createdTo) {
    where.createdAt = {
      ...(filter.createdFrom ? { gte: new Date(filter.createdFrom) } : {}),
      ...(filter.createdTo ? { lte: new Date(filter.createdTo) } : {}),
    };
  }
  if (filter.tags && filter.tags.length > 0) where.tags = { hasSome: filter.tags };
  if (filter.city) where.city = { equals: filter.city, mode: "insensitive" };
  if (filter.minTotalSpent !== undefined || filter.maxTotalSpent !== undefined) {
    where.totalSpent = {
      ...(filter.minTotalSpent !== undefined && Number.isFinite(filter.minTotalSpent)
        ? { gte: filter.minTotalSpent }
        : {}),
      ...(filter.maxTotalSpent !== undefined && Number.isFinite(filter.maxTotalSpent)
        ? { lte: filter.maxTotalSpent }
        : {}),
    };
  }
  if (filter.hasPending !== undefined) {
    where.pendingAmount = filter.hasPending ? { gt: 0 } : { lte: 0 };
  }
  if (filter.inactiveDays && filter.inactiveDays > 0) {
    const cutoff = new Date(Date.now() - filter.inactiveDays * 86400000);
    where.orders = { none: { createdAt: { gte: cutoff } } };
  }
  return where;
}

async function loadCandidates(branchId: string, filter: AudienceFilter): Promise<AudienceCandidate[]> {
  const customers = await prisma.customer.findMany({
    where: buildCustomerWhere(branchId, filter),
    select: {
      id: true,
      name: true,
      mobile: true,
      city: true,
      totalSpent: true,
      pendingAmount: true,
      tags: true,
      createdAt: true,
      orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
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
  });
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    city: customer.city,
    totalSpent: customer.totalSpent,
    pendingAmount: customer.pendingAmount,
    tags: customer.tags || [],
    createdAt: customer.createdAt,
    lastOrderAt: customer.orders[0]?.createdAt || null,
    preference: customer.whatsappPreference,
  }));
}

async function duplicatePhoneSet(branchId: string): Promise<Set<string>> {
  const rows = await prisma.whatsAppPreference.findMany({
    where: { branchId, phoneE164: { not: null } },
    select: { phoneE164: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.phoneE164) counts.set(row.phoneE164, (counts.get(row.phoneE164) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([phone]) => phone));
}

export interface AudienceResult {
  matched: number;
  eligible: number;
  skipped: number;
  recipients: Array<{ customerId: string; phone: string; status: "pending" | "skipped"; skipReason?: string }>;
  skipCounts: Record<string, number>;
  sample: Array<{ customerId: string; customerName: string; phoneMasked: string }>;
  samplesForRender: Array<{
    customerId: string;
    values: Record<string, string>;
  }>;
}

export async function buildAudience(
  branchId: string,
  category: "marketing" | "utility",
  filterInput: unknown
): Promise<AudienceResult> {
  const filter = parseAudienceFilter(filterInput);
  const [candidates, duplicates] = await Promise.all([
    loadCandidates(branchId, filter),
    duplicatePhoneSet(branchId),
  ]);
  const recipients: AudienceResult["recipients"] = [];
  const skipCounts: Record<string, number> = {};
  const sample: AudienceResult["sample"] = [];
  const samplesForRender: AudienceResult["samplesForRender"] = [];
  let eligible = 0;

  for (const customer of candidates) {
    const pref = customer.preference;
    const normalized = normalizePhone(customer.mobile);
    const phone = pref?.phoneE164 || normalized.e164;
    const validation = pref?.phoneValidationStatus || (normalized.valid ? "valid" : "invalid");
    let skipReason: string | undefined;

    if (!phone || validation !== "valid") skipReason = "invalid_phone";
    else if (duplicates.has(phone)) skipReason = "duplicate_phone";
    else if (!pref || pref.consentStatus === "unknown") skipReason = "unknown_consent";
    else if (pref.consentStatus === "opted_out") skipReason = "opted_out";
    else if (category === "marketing" && !pref.marketingConsent) skipReason = "marketing_consent_missing";
    else if (category === "utility" && !pref.transactionalConsent) {
      skipReason = "transactional_consent_missing";
    }

    const values: Record<string, string> = {
      customer_name: customer.name || "Customer",
      customer_id: customer.id,
      city: customer.city || "",
      total_spent: String(customer.totalSpent || 0),
      pending_amount: String(customer.pendingAmount || 0),
      last_order_date: customer.lastOrderAt ? customer.lastOrderAt.toISOString().slice(0, 10) : "",
    };

    if (skipReason) {
      skipCounts[skipReason] = (skipCounts[skipReason] || 0) + 1;
      recipients.push({
        customerId: customer.id,
        phone: phone || "",
        status: "skipped",
        skipReason,
      });
    } else {
      eligible += 1;
      recipients.push({ customerId: customer.id, phone: phone!, status: "pending" });
      if (sample.length < 10) {
        sample.push({
          customerId: customer.id,
          customerName: customer.name,
          phoneMasked: maskPhone(phone),
        });
        samplesForRender.push({ customerId: customer.id, values });
      }
    }
  }

  return {
    matched: candidates.length,
    eligible,
    skipped: candidates.length - eligible,
    recipients,
    skipCounts,
    sample,
    samplesForRender,
  };
}

function campaignStatus(status: string) {
  return status;
}

export async function createCampaign(
  branchId: string,
  input: {
    name: string;
    description?: string;
    purpose: "marketing" | "utility";
    templateId: string;
    audienceFilter?: unknown;
    scheduledAt?: string | null;
    timezone?: string;
    expiresAt?: string | null;
    createdBy?: string;
  }
) {
  if (!input.name?.trim()) throw new AppError(400, "Campaign name is required");
  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: input.templateId, branchId },
  });
  if (!template) throw new AppError(404, "Template mapping not found");
  if (template.localStatus !== "approved_confirmed") {
    throw new AppError(400, "Only templates confirmed approved in Meta can be used");
  }
  if (template.category !== input.purpose) {
    throw new AppError(
      400,
      `Use a ${input.purpose} template for a ${input.purpose} campaign`
    );
  }

  return prisma.whatsAppCampaign.create({
    data: {
      branchId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      purpose: input.purpose,
      templateId: template.id,
      languageCode: template.languageCode,
      audienceFilter: (input.audienceFilter || {}) as Prisma.InputJsonValue,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      timezone: input.timezone || "Asia/Kolkata",
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      status: "DRAFT",
      createdBy: input.createdBy,
    },
    include: { template: true },
  });
}

export async function previewCampaign(branchId: string, id: string) {
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id, branchId },
    include: { template: true },
  });
  if (!campaign) throw new AppError(404, "Campaign not found");
  const category = campaign.purpose === "marketing" ? "marketing" : "utility";
  const audience = await buildAudience(branchId, category, campaign.audienceFilter);
  const sampleRender = audience.samplesForRender[0];
  const rendered = sampleRender
    ? renderTemplatePreview(campaign.template, sampleRender.values)
    : parseParameterMap(campaign.template.parameterMap).map((parameter) => ({
        key: parameter.key,
        value: `[${parameter.key}]`,
      }));

  await prisma.whatsAppCampaign.update({
    where: { id },
    data: {
      audienceMatched: audience.matched,
      eligibleCount: audience.eligible,
      skippedCount: audience.skipped,
    },
  });

  return {
    campaignId: id,
    matched: audience.matched,
    eligible: audience.eligible,
    skipped: audience.skipped,
    skipCounts: audience.skipCounts,
    sample: audience.sample,
    rendered,
    template: {
      id: campaign.template.id,
      name: campaign.template.metaTemplateName,
      language: campaign.template.languageCode,
      category: campaign.template.category,
      localStatus: campaign.template.localStatus,
    },
  };
}

export async function updateCampaign(
  branchId: string,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    purpose?: "marketing" | "utility";
    templateId?: string;
    audienceFilter?: unknown;
    scheduledAt?: string | null;
    timezone?: string;
    expiresAt?: string | null;
  }
) {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (campaign.status !== "DRAFT") throw new AppError(400, "Only draft campaigns can be edited");
  const templateId = input.templateId || campaign.templateId;
  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: templateId, branchId },
  });
  if (!template) throw new AppError(404, "Template mapping not found");
  if (template.localStatus !== "approved_confirmed") {
    throw new AppError(400, "Only templates confirmed approved in Meta can be used");
  }
  const purpose = input.purpose || campaign.purpose;
  if (template.category !== purpose) {
    throw new AppError(400, `Use a ${purpose} template for a ${purpose} campaign`);
  }
  return prisma.whatsAppCampaign.update({
    where: { id },
    data: {
      name: input.name?.trim() || campaign.name,
      description: input.description !== undefined ? input.description : campaign.description,
      purpose,
      templateId: template.id,
      languageCode: template.languageCode,
      audienceFilter: (input.audienceFilter ?? campaign.audienceFilter) as Prisma.InputJsonValue,
      scheduledAt:
        input.scheduledAt !== undefined
          ? input.scheduledAt
            ? new Date(input.scheduledAt)
            : null
          : campaign.scheduledAt,
      timezone: input.timezone || campaign.timezone,
      expiresAt:
        input.expiresAt !== undefined
          ? input.expiresAt
            ? new Date(input.expiresAt)
            : null
          : campaign.expiresAt,
    },
    include: { template: true },
  });
}

async function assertCampaignCanSend(branchId: string) {
  const gate = await getSendGate(branchId, true);
  if (!gate.allowed) {
    throw new AppError(400, `Campaign sending is disabled (${gate.reason})`);
  }
}

export async function scheduleCampaign(branchId: string, id: string, scheduledAtInput?: string) {
  await assertCampaignCanSend(branchId);
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
    throw new AppError(400, `Cannot schedule a ${campaign.status} campaign`);
  }
  const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput) : campaign.scheduledAt;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    throw new AppError(400, "A valid schedule date is required");
  }
  const preview = await previewCampaign(branchId, id);
  if (preview.eligible === 0) throw new AppError(400, "Campaign has zero eligible recipients");
  return prisma.whatsAppCampaign.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt },
  });
}

export async function startCampaignNow(branchId: string, id: string) {
  await assertCampaignCanSend(branchId);
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
    throw new AppError(400, `Cannot start a ${campaign.status} campaign`);
  }
  const preview = await previewCampaign(branchId, id);
  if (preview.eligible === 0) throw new AppError(400, "Campaign has zero eligible recipients");
  const updated = await prisma.whatsAppCampaign.update({
    where: { id },
    data: { status: "QUEUED", scheduledAt: new Date() },
  });
  await materializeCampaign(updated);
  return prisma.whatsAppCampaign.findUnique({ where: { id } });
}

export async function pauseCampaign(branchId: string, id: string) {
  const updated = await prisma.whatsAppCampaign.updateMany({
    where: { id, branchId, status: { in: ["SCHEDULED", "QUEUED", "PROCESSING"] } },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  if (updated.count === 0) throw new AppError(400, "Campaign cannot be paused in its current state");
  return prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
}

export async function resumeCampaign(branchId: string, id: string) {
  await assertCampaignCanSend(branchId);
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (campaign.status !== "PAUSED") throw new AppError(400, "Only paused campaigns can resume");
  return prisma.whatsAppCampaign.update({
    where: { id },
    data: { status: "PROCESSING", pausedAt: null },
  });
}

export async function cancelCampaign(branchId: string, id: string) {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (["COMPLETED", "CANCELLED"].includes(campaign.status)) {
    throw new AppError(400, "Campaign is already finished");
  }
  return prisma.$transaction(async (tx) => {
    await tx.whatsAppCampaignRecipient.updateMany({
      where: { campaignId: id, status: { in: ["pending", "queued"] } },
      data: { status: "skipped", skipReason: "campaign_cancelled", nextAttemptAt: null },
    });
    return tx.whatsAppCampaign.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });
}

export async function retryCampaignFailures(branchId: string, id: string) {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  const retryable = await prisma.whatsAppCampaignRecipient.findMany({
    where: {
      campaignId: id,
      status: "failed",
      providerMessageId: null,
      lastErrorClass: { in: ["transient_network", "provider_5xx", "rate_limited", "stalled"] },
    },
    select: { id: true, customerId: true },
  });
  if (retryable.length === 0) return { retried: 0 };
  const ids = retryable.map((row) => row.id);
  await prisma.$transaction(async (tx) => {
    await tx.whatsAppCampaignRecipient.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "pending",
        attempts: 0,
        nextAttemptAt: null,
        errorCode: null,
        errorMessageSafe: null,
        lastErrorClass: null,
        failedAt: null,
      },
    });
    for (const recipient of retryable) {
      await tx.whatsAppMessage.updateMany({
        where: {
          idempotencyKey: `campaign:${id}:${recipient.customerId}`,
          providerMessageId: null,
        },
        data: { status: "retryable", errorCode: null, errorMessageSafe: null, failedAt: null },
      });
    }
    await tx.whatsAppCampaign.update({
      where: { id },
      data: { status: "PROCESSING", completedAt: null, lastError: null },
    });
  });
  return { retried: retryable.length };
}

export async function cloneCampaign(branchId: string, id: string, createdBy?: string) {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, branchId } });
  if (!campaign) throw new AppError(404, "Campaign not found");
  return prisma.whatsAppCampaign.create({
    data: {
      branchId,
      name: `${campaign.name} (copy)`,
      description: campaign.description,
      purpose: campaign.purpose,
      templateId: campaign.templateId,
      languageCode: campaign.languageCode,
      audienceFilter: campaign.audienceFilter as Prisma.InputJsonValue,
      timezone: campaign.timezone,
      expiresAt: campaign.expiresAt,
      status: "DRAFT",
      createdBy,
    },
  });
}

export async function listCampaigns(
  branchId: string,
  query: { page?: string; limit?: string; status?: string }
) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || "25", 10) || 25));
  const where: Prisma.WhatsAppCampaignWhereInput = { branchId };
  if (query.status) where.status = query.status;
  const [data, total] = await Promise.all([
    prisma.whatsAppCampaign.findMany({
      where,
      include: { template: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppCampaign.count({ where }),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

export async function getCampaignAnalytics(branchId: string, id: string) {
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id, branchId },
    include: { template: true },
  });
  if (!campaign) throw new AppError(404, "Campaign not found");
  const grouped = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: true,
  });
  const counts = Object.fromEntries(
    grouped.map((row) => [row.status, row._count])
  ) as Record<string, number>;
  const skipReasons = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["skipReason"],
    where: { campaignId: id, status: "skipped", skipReason: { not: null } },
    _count: true,
  });
  return {
    campaign,
    counts,
    skipReasons: Object.fromEntries(
      skipReasons.map((row) => [row.skipReason || "unknown", row._count])
    ),
  };
}

export async function listCampaignRecipients(
  branchId: string,
  campaignId: string,
  query: { page?: string; limit?: string; status?: string }
) {
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, branchId },
    select: { id: true },
  });
  if (!campaign) throw new AppError(404, "Campaign not found");
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || "50", 10) || 50));
  const where: Prisma.WhatsAppCampaignRecipientWhereInput = { campaignId };
  if (query.status) where.status = query.status;
  const [rows, total] = await Promise.all([
    prisma.whatsAppCampaignRecipient.findMany({
      where,
      include: { customer: { select: { id: true, name: true, customerId: true } } },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppCampaignRecipient.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      ...row,
      phoneE164: undefined,
      phoneMasked: maskPhone(row.phoneE164),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function materializeCampaign(campaign: {
  id: string;
  branchId: string;
  purpose: string;
  audienceFilter: unknown;
  status: string;
  expiresAt: Date | null;
}) {
  if (campaign.expiresAt && campaign.expiresAt.getTime() < Date.now()) {
    await prisma.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), lastError: "Campaign expired" },
    });
    return;
  }

  const claimed = await prisma.whatsAppCampaign.updateMany({
    where: { id: campaign.id, status: { in: ["QUEUED", "SCHEDULED"] } },
    data: { status: "QUEUED", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const category = campaign.purpose === "marketing" ? "marketing" : "utility";
  const audience = await buildAudience(campaign.branchId, category, campaign.audienceFilter);
  const existingCount = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId: campaign.id },
  });
  if (existingCount === 0) {
    const chunkSize = 1000;
    for (let index = 0; index < audience.recipients.length; index += chunkSize) {
      const chunk = audience.recipients.slice(index, index + chunkSize);
      await prisma.whatsAppCampaignRecipient.createMany({
        data: chunk.map((recipient) => ({
          branchId: campaign.branchId,
          campaignId: campaign.id,
          customerId: recipient.customerId,
          phoneE164: recipient.phone,
          status: recipient.status,
          skipReason: recipient.skipReason,
          idempotencyKey: `campaign:${campaign.id}:${recipient.customerId}`,
        })),
        skipDuplicates: true,
      });
    }
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "PROCESSING",
      audienceMatched: audience.matched,
      eligibleCount: audience.eligible,
      skippedCount: audience.skipped,
    },
  });
}

export async function materializeDueCampaigns(limit = 5) {
  const due = await prisma.whatsAppCampaign.findMany({
    where: {
      status: { in: ["SCHEDULED", "QUEUED"] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  for (const campaign of due) {
    try {
      await materializeCampaign(campaign);
    } catch (err) {
      logger.error("Failed to materialize WhatsApp campaign", {
        campaignId: campaign.id,
        error: (err as Error).message,
      });
      await prisma.whatsAppCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED", lastError: toSafeErrorMessage(err) },
      });
    }
  }
  return due.length;
}

function campaignParameterValues(customer: {
  id: string;
  name: string;
  city: string | null;
  totalSpent: number;
  pendingAmount: number;
}) {
  return {
    customer_name: customer.name || "Customer",
    customer_id: customer.id,
    city: customer.city || "",
    total_spent: String(customer.totalSpent || 0),
    pending_amount: String(customer.pendingAmount || 0),
  };
}

async function finalizeCampaign(campaignId: string) {
  const grouped = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: true,
  });
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count]));
  const remaining = (counts.pending || 0) + (counts.queued || 0);
  if (remaining > 0) return;
  const failed = (counts.failed || 0) + (counts.skipped || 0);
  await prisma.whatsAppCampaign.updateMany({
    where: { id: campaignId, status: "PROCESSING" },
    data: {
      status: failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export async function processCampaignRecipients(branchId: string, limit = 10) {
  const gate = await getSendGate(branchId, true);
  if (!gate.allowed) return 0;

  const campaigns = await prisma.whatsAppCampaign.findMany({
    where: { branchId, status: "PROCESSING" },
    include: { template: true },
    take: 5,
  });
  let processed = 0;

  for (const campaign of campaigns) {
    if (campaign.expiresAt && campaign.expiresAt.getTime() < Date.now()) {
      await cancelCampaign(branchId, campaign.id);
      continue;
    }
    if (campaign.template.localStatus !== "approved_confirmed") {
      await prisma.whatsAppCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED", lastError: "Template is not confirmed approved" },
      });
      continue;
    }

    const recipients = await prisma.whatsAppCampaignRecipient.findMany({
      where: {
        campaignId: campaign.id,
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            city: true,
            totalSpent: true,
            pendingAmount: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    for (const recipient of recipients) {
      const claimed = await prisma.whatsAppCampaignRecipient.updateMany({
        where: { id: recipient.id, status: "pending" },
        data: { status: "queued" },
      });
      if (claimed.count === 0) continue;
      processed += 1;

      const currentCampaign = await prisma.whatsAppCampaign.findUnique({
        where: { id: campaign.id },
        select: { status: true },
      });
      if (currentCampaign?.status !== "PROCESSING") {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "pending" },
        });
        continue;
      }

      const pref = await prisma.whatsAppPreference.findUnique({
        where: { customerId: recipient.customerId },
      });
      if (!pref || pref.consentStatus !== "opted_in" || !pref.marketingConsent || !pref.phoneE164) {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "skipped", skipReason: "consent_changed" },
        });
        continue;
      }

      const template = await getApprovedTemplateForEvent(
        branchId,
        "MARKETING_CAMPAIGN",
        campaign.languageCode,
        campaign.templateId
      );
      const { resolveTemplateParameters } = await import("./templates");
      let parameters: string[];
      try {
        parameters = resolveTemplateParameters(
          template,
          campaignParameterValues(recipient.customer)
        );
      } catch (err) {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "skipped",
            skipReason: "template_mapping_failed",
            errorMessageSafe: toSafeErrorMessage(err),
          },
        });
        continue;
      }

      const idempotencyKey = `campaign:${campaign.id}:${recipient.customerId}`;
      const existing = await prisma.whatsAppMessage.findUnique({ where: { idempotencyKey } });
      if (existing?.providerMessageId) {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "submitted",
            providerMessageId: existing.providerMessageId,
            submittedAt: existing.submittedAt || new Date(),
          },
        });
        continue;
      }
      if (existing?.status === "submitting" || existing?.status === "submission_unknown") {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            providerMessageId: null,
            errorMessageSafe: "Provider acceptance is unknown; retry suppressed",
            lastErrorClass: "submission_unknown",
            failedAt: new Date(),
          },
        });
        continue;
      }

      const message = existing
        ? await prisma.whatsAppMessage.update({
            where: { id: existing.id },
            data: {
              status: "submitting",
              submittedAt: new Date(),
              errorCode: null,
              errorMessageSafe: null,
              failedAt: null,
            },
          })
        : await prisma.whatsAppMessage.create({
            data: {
              branchId,
              customerId: recipient.customerId,
              campaignId: campaign.id,
              templateId: template.id,
              direction: "outbound",
              messageType: "template",
              category: "marketing",
              phoneE164: recipient.phoneE164,
              templateName: template.metaTemplateName,
              languageCode: template.languageCode,
              contentPreview: `Campaign: ${campaign.name}`.slice(0, 300),
              status: "submitting",
              idempotencyKey,
              submittedAt: new Date(),
            },
          });

      try {
        const result = await getWhatsAppProvider().sendTemplate({
          to: recipient.phoneE164,
          templateName: template.metaTemplateName,
          languageCode: template.languageCode,
          bodyParameters: parameters,
          idempotencyKey,
        });
        await prisma.$transaction([
          prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              providerMessageId: result.providerMessageId,
              providerStatus: result.providerStatus,
              status: "submitted",
              submittedAt: result.acceptedAt,
            },
          }),
          prisma.whatsAppCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "submitted",
              providerMessageId: result.providerMessageId,
              submittedAt: result.acceptedAt,
              attempts: { increment: 1 },
              lastErrorClass: null,
              errorMessageSafe: null,
            },
          }),
        ]);
      } catch (err) {
        if (err instanceof WhatsAppProviderError) {
          const attempts = recipient.attempts + 1;
          const canRetry =
            err.retryable && err.safeToRetry && attempts < getWhatsAppConfig().maxAttempts;
          await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              status: canRetry ? "retryable" : err.safeToRetry ? "failed" : "submission_unknown",
              errorCode: err.providerCode || err.classification,
              errorMessageSafe: toSafeErrorMessage(err),
              failedAt: canRetry ? null : new Date(),
            },
          });
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: canRetry ? "pending" : "failed",
              attempts,
              nextAttemptAt: canRetry
                ? new Date(Date.now() + backoffDelayMs(attempts))
                : null,
              errorCode: err.providerCode || err.classification,
              errorMessageSafe: toSafeErrorMessage(err),
              lastErrorClass: err.classification,
              failedAt: canRetry ? null : new Date(),
            },
          });
        } else {
          await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              status: "submission_unknown",
              errorMessageSafe: toSafeErrorMessage(err),
              failedAt: new Date(),
            },
          });
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "failed",
              errorMessageSafe: toSafeErrorMessage(err),
              lastErrorClass: "unknown",
              failedAt: new Date(),
            },
          });
        }
      }
    }

    await finalizeCampaign(campaign.id);
  }

  return processed;
}

export { campaignStatus, buildCustomerWhere, parseAudienceFilter };
