import { hostname } from "os";
import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { getWhatsAppConfig, isWorkerWindowOpen } from "./config";
import { materializeDueCampaigns, processCampaignRecipients } from "./campaign";
import { processOutboxBatch } from "./outbox";
import { processDueReminders } from "./reminders";
import { purgeExpiredWhatsAppData, RETENTION_SWEEP_INTERVAL_MS } from "./retention";
import { processPendingWebhookEvents } from "./webhook";

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

let lastRetentionSweepAt = 0;

async function processingBranches(): Promise<string[]> {
  const [campaignBranches, reminderBranches] = await Promise.all([
    prisma.whatsAppCampaign.groupBy({
      by: ["branchId"],
      where: { status: "PROCESSING" },
    }),
    prisma.whatsAppReminder.findMany({
      where: { status: "pending", dueAt: { lte: new Date() } },
      select: { branchId: true },
      distinct: ["branchId"],
      take: 20,
    }),
  ]);
  return [
    ...new Set([
      ...campaignBranches.map((row) => row.branchId),
      ...reminderBranches.map((row) => row.branchId),
    ]),
  ];
}

export async function runWhatsAppWorkerOnce(): Promise<{
  outbox: number;
  webhooks: number;
  reminders: number;
  campaigns: number;
  campaignRecipients: number;
}> {
  const cfg = getWhatsAppConfig();
  await materializeDueCampaigns();
  const webhooks = await processPendingWebhookEvents();
  const reminders = await processDueReminders();
  const outbox = await processOutboxBatch(workerId, cfg.maxWorkerConcurrency * 5);

  let campaigns = 0;
  let campaignRecipients = 0;
  const branches = await processingBranches();
  for (const branchId of branches) {
    campaignRecipients += await processCampaignRecipients(branchId, cfg.maxWorkerConcurrency);
    campaigns += 1;
  }

  return { outbox, webhooks, reminders, campaigns, campaignRecipients };
}

export function startWhatsAppWorker(): () => void {
  const cfg = getWhatsAppConfig();
  let running = false;
  let stopped = false;
  let windowState: boolean | null = null;

  const tick = async () => {
    if (running || stopped) return;

    const windowOpen = isWorkerWindowOpen(cfg);
    if (windowState !== windowOpen) {
      windowState = windowOpen;
      logger.info(
        windowOpen
          ? "WhatsApp worker window is open"
          : "WhatsApp worker is paused outside the configured window",
        {
          workerId,
          windowEnabled: cfg.workerWindowEnabled,
          startHour: cfg.workerWindowStart,
          endHour: cfg.workerWindowEnd,
          timezone: cfg.workerWindowTimezone,
        }
      );
    }
    if (!windowOpen) return;

    running = true;
    try {
      if (Date.now() - lastRetentionSweepAt >= RETENTION_SWEEP_INTERVAL_MS) {
        lastRetentionSweepAt = Date.now();
        try {
          await purgeExpiredWhatsAppData();
        } catch (err) {
          logger.error("WhatsApp retention sweep failed", {
            workerId,
            error: (err as Error).message,
          });
        }
      }

      const result = await runWhatsAppWorkerOnce();
      const workDone = Object.values(result).some((value) => value > 0);
      if (workDone) {
        logger.info("WhatsApp worker processed work", { workerId, ...result });
      }
    } catch (err) {
      logger.error("WhatsApp worker tick failed", {
        workerId,
        error: (err as Error).message,
      });
    } finally {
      running = false;
    }
  };

  logger.info("WhatsApp worker started", {
    workerId,
    provider: cfg.provider,
    pollMs: cfg.workerPollMs,
    concurrency: cfg.maxWorkerConcurrency,
    sendEnabled: cfg.sendEnabled,
    campaignSendEnabled: cfg.campaignSendEnabled,
  });

  void tick();
  const timer = setInterval(() => void tick(), cfg.workerPollMs);

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    logger.info("WhatsApp worker stopped", { workerId });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return stop;
}
