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
import { onWhatsAppWorkerWake } from "./wake";

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const DRAIN_DELAY_MS = 1000;
const WAKE_DELAY_MS = 250;

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
  materialized: number;
}> {
  const cfg = getWhatsAppConfig();
  const materialized = await materializeDueCampaigns();
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

  return { outbox, webhooks, reminders, campaigns, campaignRecipients, materialized };
}

export function startWhatsAppWorker(): () => void {
  const cfg = getWhatsAppConfig();
  let running = false;
  let stopped = false;
  let pendingWake = false;
  let scheduled: ReturnType<typeof setTimeout> | null = null;
  let windowState: boolean | null = null;

  const scheduleTick = (delayMs: number) => {
    if (stopped || scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      void tick();
    }, delayMs);
  };

  const wake = () => {
    if (stopped) return;
    pendingWake = true;
    if (!running) scheduleTick(WAKE_DELAY_MS);
  };

  const tick = async () => {
    if (running || stopped) {
      if (running) pendingWake = true;
      return;
    }

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
    if (!windowOpen) {
      pendingWake = false;
      return;
    }

    pendingWake = false;
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
      const workDone =
        result.outbox > 0 ||
        result.webhooks > 0 ||
        result.reminders > 0 ||
        result.campaignRecipients > 0 ||
        result.materialized > 0;
      if (workDone) {
        logger.info("WhatsApp worker processed work", { workerId, ...result });
        // Keep draining a campaign/outbox burst, but only while work remains.
        scheduleTick(DRAIN_DELAY_MS);
      }
    } catch (err) {
      logger.error("WhatsApp worker tick failed", {
        workerId,
        error: (err as Error).message,
      });
    } finally {
      running = false;
      if (pendingWake && !stopped && !scheduled) scheduleTick(WAKE_DELAY_MS);
    }
  };

  logger.info("WhatsApp worker started", {
    workerId,
    provider: cfg.provider,
    mode: "event-driven",
    fallbackPollMs: cfg.workerPollMs,
    concurrency: cfg.maxWorkerConcurrency,
    sendEnabled: cfg.sendEnabled,
    campaignSendEnabled: cfg.campaignSendEnabled,
  });

  const unregisterWake = onWhatsAppWorkerWake(wake);
  void tick();
  const timer = setInterval(() => void tick(), cfg.workerPollMs);

  const stop = () => {
    stopped = true;
    pendingWake = false;
    clearInterval(timer);
    if (scheduled) {
      clearTimeout(scheduled);
      scheduled = null;
    }
    unregisterWake();
    logger.info("WhatsApp worker stopped", { workerId });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return stop;
}
