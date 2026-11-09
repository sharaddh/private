import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import { getWhatsAppConfig, getConfigStatus, isMetaConfigured, isWorkerWindowOpen } from "./config";
import { getWhatsAppProvider } from "./provider-factory";

export async function getBranchSettings(branchId: string) {
  return prisma.whatsAppSetting.upsert({
    where: { branchId },
    create: { branchId },
    update: {},
  });
}

export interface SendGate {
  allowed: boolean;
  reason?: string;
}

export async function getSendGate(branchId: string, campaign = false): Promise<SendGate> {
  const cfg = getWhatsAppConfig();
  if (cfg.provider === "meta" && !isMetaConfigured(cfg)) {
    return { allowed: false, reason: "provider_not_configured" };
  }
  if (!cfg.sendEnabled) return { allowed: false, reason: "live_sending_disabled" };
  if (campaign && !cfg.campaignSendEnabled) {
    return { allowed: false, reason: "campaign_sending_disabled" };
  }
  const settings = await getBranchSettings(branchId);
  if (settings.killSwitch) return { allowed: false, reason: "kill_switch_enabled" };
  if (!settings.sendEnabled) return { allowed: false, reason: "branch_sending_disabled" };
  if (campaign && !settings.campaignSendEnabled) {
    return { allowed: false, reason: "branch_campaign_sending_disabled" };
  }
  return { allowed: true };
}

export async function updateBranchSettings(
  branchId: string,
  input: {
    sendEnabled?: boolean;
    campaignSendEnabled?: boolean;
    killSwitch?: boolean;
    reminderEnabled?: boolean;
    retentionDays?: number;
    updatedBy?: string;
  }
) {
  const current = await getBranchSettings(branchId);
  if (input.campaignSendEnabled && !(input.sendEnabled ?? current.sendEnabled)) {
    throw new AppError(400, "Enable WhatsApp sending before enabling campaigns");
  }
  return prisma.whatsAppSetting.update({
    where: { branchId },
    data: {
      sendEnabled: input.sendEnabled ?? current.sendEnabled,
      campaignSendEnabled: input.campaignSendEnabled ?? current.campaignSendEnabled,
      killSwitch: input.killSwitch ?? current.killSwitch,
      reminderEnabled: input.reminderEnabled ?? current.reminderEnabled,
      retentionDays:
        input.retentionDays !== undefined
          ? Math.min(3650, Math.max(1, Math.trunc(input.retentionDays)))
          : current.retentionDays,
      updatedBy: input.updatedBy,
    },
  });
}

export async function getStatus(branchId: string) {
  const cfg = getWhatsAppConfig();
  const settings = await getBranchSettings(branchId);
  const provider = getWhatsAppProvider();
  let health: Record<string, unknown> | null = null;
  if (cfg.provider === "meta" && provider.isConfigured() && provider.getPhoneNumberHealth) {
    try {
      health = { ...(await provider.getPhoneNumberHealth()) };
    } catch {
      health = { status: "unreachable" };
    }
  }
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [submittedToday, deliveredToday, failedToday, outboxPending, outboxFailed, lastError] =
    await Promise.all([
      prisma.whatsAppMessage.count({
        where: { branchId, direction: "outbound", createdAt: { gte: startOfDay } },
      }),
      prisma.whatsAppMessage.count({
        where: {
          branchId,
          direction: "outbound",
          deliveredAt: { gte: startOfDay },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          branchId,
          direction: "outbound",
          failedAt: { gte: startOfDay },
        },
      }),
      prisma.whatsAppOutbox.count({ where: { branchId, status: { in: ["pending", "processing"] } } }),
      prisma.whatsAppOutbox.count({ where: { branchId, status: "failed" } }),
      prisma.whatsAppOutbox.findFirst({
        where: { branchId, status: "failed" },
        orderBy: { updatedAt: "desc" },
        select: { lastError: true, lastErrorClass: true, updatedAt: true, eventType: true },
      }),
    ]);

  return {
    provider: cfg.provider,
    providerConfigured: isMetaConfigured(cfg),
    config: getConfigStatus(),
    settings,
    effectiveSendEnabled:
      cfg.sendEnabled && settings.sendEnabled && !settings.killSwitch && provider.isConfigured(),
    effectiveCampaignSendEnabled:
      cfg.campaignSendEnabled && settings.campaignSendEnabled && settings.sendEnabled && !settings.killSwitch && provider.isConfigured(),
    health,
    today: { submitted: submittedToday, delivered: deliveredToday, failed: failedToday },
    queue: { pending: outboxPending, failed: outboxFailed, lastError },
    webhook: {
      publicUrlSet: Boolean(cfg.webhookPublicUrl),
      appSecretSet: Boolean(cfg.appSecret),
      verifyTokenSet: Boolean(cfg.webhookVerifyToken),
    },
    worker: {
      inline: cfg.workerInline,
      pollMs: cfg.workerPollMs,
      maxConcurrency: cfg.maxWorkerConcurrency,
      queueName: cfg.queueName,
      windowOpen: isWorkerWindowOpen(cfg),
      windowEnabled: cfg.workerWindowEnabled,
      windowStart: cfg.workerWindowStart,
      windowEnd: cfg.workerWindowEnd,
      windowTimezone: cfg.workerWindowTimezone,
    },
  };
}

