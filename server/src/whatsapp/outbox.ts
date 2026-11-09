import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { buildEventContext } from "./context";
import { checkEligibility } from "./consent";
import { getWhatsAppConfig } from "./config";
import { getWhatsAppProvider } from "./provider-factory";
import { getSendGate } from "./settings";
import {
  TemplateMappingError,
  getApprovedTemplateForEvent,
  resolveTemplateParameters,
} from "./templates";
import { WhatsAppProviderError, toSafeErrorMessage } from "./provider";
import { getEventDefinition } from "./types";

export function backoffDelayMs(attempts: number): number {
  const base = Math.min(3600, Math.pow(2, Math.max(0, attempts)) * 30) * 1000;
  return base + Math.floor(Math.random() * 15_000);
}

export async function claimOutboxBatch(workerId: string, limit = 10) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.whatsAppOutbox.updateMany({
    where: { status: "processing", lockedAt: { lt: staleBefore } },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
      lastError: "Recovered stalled worker lock",
      lastErrorClass: "stalled_recovery",
    },
  });

  const candidates = await prisma.whatsAppOutbox.findMany({
    where: { status: "pending", availableAt: { lte: new Date() } },
    orderBy: { availableAt: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const candidate of candidates) {
    const result = await prisma.whatsAppOutbox.updateMany({
      where: { id: candidate.id, status: "pending" },
      data: {
        status: "processing",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
    if (result.count === 1) {
      claimed.push({ ...candidate, attempts: candidate.attempts + 1 });
    }
  }
  return claimed;
}

async function completeOutbox(id: string, reason?: string, errorClass?: string) {
  await prisma.whatsAppOutbox.updateMany({
    where: { id },
    data: {
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: reason,
      lastErrorClass: errorClass,
    },
  });
}

async function failOutbox(id: string, reason: string, errorClass: string) {
  await prisma.whatsAppOutbox.updateMany({
    where: { id },
    data: {
      status: "failed",
      lockedAt: null,
      lockedBy: null,
      lastError: toSafeErrorMessage(reason),
      lastErrorClass: errorClass,
    },
  });
}

async function retryOutbox(id: string, attempts: number, reason: string, errorClass: string) {
  await prisma.whatsAppOutbox.updateMany({
    where: { id },
    data: {
      status: "pending",
      availableAt: new Date(Date.now() + backoffDelayMs(attempts)),
      lockedAt: null,
      lockedBy: null,
      lastError: toSafeErrorMessage(reason),
      lastErrorClass: errorClass,
    },
  });
}

type OutboxItem = Awaited<ReturnType<typeof claimOutboxBatch>>[number];

export async function processOutboxItem(item: OutboxItem): Promise<void> {
  const event = getEventDefinition(item.eventType);
  if (!event) {
    await failOutbox(item.id, `Unsupported event type: ${item.eventType}`, "unsupported_event");
    return;
  }

  const payload = (item.payload || {}) as Record<string, unknown>;
  const isReminder = item.eventType === "PAYMENT_BALANCE_DUE" && Boolean(payload.reminderId);
  const trigger = isReminder
    ? null
    : await prisma.whatsAppTrigger.findUnique({
        where: { branchId_eventKey: { branchId: item.branchId, eventKey: item.eventType } },
        include: { template: true },
      });
  if (!isReminder && (!trigger || !trigger.enabled)) {
    await completeOutbox(item.id, "Skipped: trigger disabled", "trigger_disabled");
    return;
  }

  const gate = await getSendGate(item.branchId, false);
  if (!gate.allowed) {
    await completeOutbox(item.id, `Skipped: ${gate.reason}`, "sending_disabled");
    return;
  }

  const templateId = payload.templateId ? String(payload.templateId) : trigger?.templateId;
  let template;
  try {
    template = await getApprovedTemplateForEvent(
      item.branchId,
      item.eventType,
      trigger?.template?.languageCode || "en",
      templateId
    );
  } catch (err) {
    await failOutbox(
      item.id,
      (err as Error).message,
      err instanceof TemplateMappingError ? err.reason : "template_unavailable"
    );
    return;
  }

  const category = event.category === "marketing" ? "marketing" : "transactional";
  const eligibility = await checkEligibility(item.branchId, item.customerId, category);
  if (!eligibility.eligible) {
    await completeOutbox(
      item.id,
      `Skipped: ${eligibility.reason || "not_eligible"}`,
      "recipient_ineligible"
    );
    return;
  }
  if (!eligibility.phoneE164) {
    await completeOutbox(item.id, "Skipped: invalid phone", "invalid_phone");
    return;
  }

  let context;
  let parameters: string[];
  try {
    context = await buildEventContext({
      branchId: item.branchId,
      eventKey: item.eventType,
      entityType: item.entityType,
      entityId: item.entityId,
      customerId: item.customerId,
      payload,
    });
    parameters = resolveTemplateParameters(template, context.values);
  } catch (err) {
    await failOutbox(
      item.id,
      (err as Error).message,
      err instanceof TemplateMappingError ? err.reason : "template_mapping_failed"
    );
    return;
  }

  const idempotencyKey = `outbox:${item.eventId}`;
  const existing = await prisma.whatsAppMessage.findUnique({ where: { idempotencyKey } });
  if (existing?.providerMessageId) {
    await completeOutbox(item.id, "Already accepted by provider", "idempotent_replay");
    return;
  }
  if (existing?.status === "submitting" || existing?.status === "submission_unknown") {
    await prisma.whatsAppMessage.update({
      where: { id: existing.id },
      data: {
        status: "submission_unknown",
        errorMessageSafe: "Worker stopped before provider acceptance was confirmed",
        failedAt: new Date(),
      },
    });
    await failOutbox(
      item.id,
      "Provider acceptance is unknown; automatic retry suppressed to avoid a duplicate send",
      "submission_unknown"
    );
    return;
  }
  if (existing?.status === "failed") {
    await failOutbox(item.id, existing.errorMessageSafe || "Message previously failed", "message_failed");
    return;
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
          branchId: item.branchId,
          customerId: item.customerId,
          outboxId: item.id,
          templateId: template.id,
          direction: "outbound",
          messageType: context.document ? "document" : "template",
          category: event.category,
          phoneE164: eligibility.phoneE164,
          templateName: template.metaTemplateName,
          languageCode: template.languageCode,
          contentPreview: `${event.description} (${template.metaTemplateName})`.slice(0, 300),
          status: "submitting",
          idempotencyKey,
          submittedAt: new Date(),
        },
      });

  const provider = getWhatsAppProvider();
  try {
    const result = context.document
      ? await provider.sendDocumentTemplate({
          to: eligibility.phoneE164,
          templateName: template.metaTemplateName,
          languageCode: template.languageCode,
          bodyParameters: parameters,
          header: {
            type: "document",
            filename: context.document.filename,
          },
          document: context.document,
          idempotencyKey,
        })
      : await provider.sendTemplate({
          to: eligibility.phoneE164,
          templateName: template.metaTemplateName,
          languageCode: template.languageCode,
          bodyParameters: parameters,
          idempotencyKey,
        });

    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus,
        status: "submitted",
        submittedAt: result.acceptedAt,
      },
    });
    await completeOutbox(item.id);
  } catch (err) {
    if (err instanceof WhatsAppProviderError) {
      const canRetry =
        err.retryable &&
        err.safeToRetry &&
        item.attempts < getWhatsAppConfig().maxAttempts;
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: canRetry ? "retryable" : err.safeToRetry ? "failed" : "submission_unknown",
          errorCode: err.providerCode || err.classification,
          errorMessageSafe: toSafeErrorMessage(err.message),
          failedAt: canRetry ? null : new Date(),
        },
      });
      if (canRetry) {
        await retryOutbox(item.id, item.attempts, err.message, err.classification);
      } else {
        await failOutbox(
          item.id,
          err.message,
          err.safeToRetry ? err.classification : "submission_unknown"
        );
      }
      return;
    }

    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "submission_unknown",
        errorMessageSafe: toSafeErrorMessage(err),
        failedAt: new Date(),
      },
    });
    await failOutbox(item.id, toSafeErrorMessage(err), "unknown");
  }
}

export async function processOutboxBatch(workerId: string, limit = 10): Promise<number> {
  const items = await claimOutboxBatch(workerId, limit);
  for (const item of items) {
    try {
      await processOutboxItem(item);
    } catch (err) {
      logger.error("Unhandled WhatsApp outbox processing error", {
        outboxId: item.id,
        eventType: item.eventType,
        error: (err as Error).message,
      });
      await failOutbox(item.id, (err as Error).message, "worker_error");
    }
  }
  return items.length;
}

export async function retryFailedOutbox(id: string, branchId: string) {
  const item = await prisma.whatsAppOutbox.findFirst({ where: { id, branchId } });
  if (!item) return null;
  if (item.status !== "failed") return item;
  if (item.lastErrorClass === "submission_unknown") return item;
  return prisma.whatsAppOutbox.update({
    where: { id },
    data: {
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      lastErrorClass: null,
    },
  });
}

export async function getOutboxQueueStats(branchId: string) {
  const rows = await prisma.whatsAppOutbox.groupBy({
    by: ["status"],
    where: { branchId },
    _count: true,
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count])) as Record<string, number>;
}
