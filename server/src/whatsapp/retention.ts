import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";

export const DEFAULT_RETENTION_DAYS = 180;
export const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const TERMINAL_MESSAGE_STATUSES = [
  "submitted",
  "sent",
  "delivered",
  "read",
  "failed",
  "submission_unknown",
];
const TERMINAL_OUTBOX_STATUSES = ["completed", "failed"];
const TERMINAL_WEBHOOK_STATUSES = ["processed", "ignored", "failed"];
const TERMINAL_REMINDER_STATUSES = ["completed", "skipped", "cancelled"];

function cutoffFor(days: number, now: Date): Date {
  const safeDays = Math.min(3650, Math.max(1, Math.trunc(days)));
  return new Date(now.getTime() - safeDays * 86400000);
}

export interface RetentionSweepResult {
  branches: number;
  messages: number;
  outbox: number;
  webhookEvents: number;
  reminders: number;
}

export async function purgeExpiredWhatsAppData(
  now: Date = new Date()
): Promise<RetentionSweepResult> {
  const settings = await prisma.whatsAppSetting.findMany({
    select: { branchId: true, retentionDays: true },
  });

  const result: RetentionSweepResult = {
    branches: settings.length,
    messages: 0,
    outbox: 0,
    webhookEvents: 0,
    reminders: 0,
  };

  for (const setting of settings) {
    const cutoff = cutoffFor(setting.retentionDays ?? DEFAULT_RETENTION_DAYS, now);

    const messages = await prisma.whatsAppMessage.deleteMany({
      where: {
        branchId: setting.branchId,
        createdAt: { lt: cutoff },
        status: { in: TERMINAL_MESSAGE_STATUSES },
      },
    });
    const outbox = await prisma.whatsAppOutbox.deleteMany({
      where: {
        branchId: setting.branchId,
        createdAt: { lt: cutoff },
        status: { in: TERMINAL_OUTBOX_STATUSES },
      },
    });
    const reminders = await prisma.whatsAppReminder.deleteMany({
      where: {
        branchId: setting.branchId,
        createdAt: { lt: cutoff },
        status: { in: TERMINAL_REMINDER_STATUSES },
      },
    });

    result.messages += messages.count;
    result.outbox += outbox.count;
    result.reminders += reminders.count;
  }

  const cutoff = cutoffFor(DEFAULT_RETENTION_DAYS, now);
  const webhookEvents = await prisma.whatsAppWebhookEvent.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      status: { in: TERMINAL_WEBHOOK_STATUSES },
    },
  });
  result.webhookEvents = webhookEvents.count;

  if (result.messages || result.outbox || result.webhookEvents || result.reminders) {
    logger.info("Purged expired WhatsApp records", { ...result });
  }

  return result;
}
