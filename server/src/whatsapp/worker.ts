import { hostname } from "os";
import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { getWhatsAppConfig, isWorkerWindowOpen } from "./config";
import { materializeDueCampaigns, processCampaignRecipients } from "./campaign";
import { classifyError, type ClassifiedError } from "./db-error";
import { processOutboxBatch } from "./outbox";
import { processDueReminders } from "./reminders";
import {
  purgeExpiredWhatsAppData,
  RETENTION_SWEEP_INTERVAL_MS,
  type RetentionSweepResult,
} from "./retention";
import { processPendingWebhookEvents } from "./webhook";
import { onWhatsAppWorkerWake, type WhatsAppWorkerWakeReason } from "./wake";

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const DRAIN_DELAY_MS = 1000;
const WAKE_DELAY_MS = 250;
const MAX_DRAIN_CYCLES = 3;
const WEBHOOK_BATCH_LIMIT = 50;
const REMINDER_BATCH_LIMIT = 20;
const CAMPAIGN_MATERIALIZE_LIMIT = 5;
const BRANCH_SCAN_LIMIT = 20;
export const DB_BACKOFF_BASE_MS = 1000;
export const DB_BACKOFF_MAX_MS = 60_000;
export const DB_BACKOFF_JITTER_MS = 250;

export interface WhatsAppWorkerCounts {
  materialized: number;
  webhooks: number;
  reminders: number;
  outbox: number;
  campaigns: number;
  campaignRecipients: number;
}

export interface WhatsAppWorkerRunResult extends WhatsAppWorkerCounts {
  moreWork: boolean;
}

type TickPhase = "start" | "end" | "failed";

interface TickMetricInput {
  tickId: string;
  reason: WhatsAppWorkerWakeReason;
  phase: TickPhase;
  windowOpen: boolean;
  event?: string;
  durationMs?: number;
  workFound?: boolean;
  counts?: WhatsAppWorkerCounts;
  error?: ClassifiedError | null;
  backoffMs?: number;
  drainCycle?: number;
  blocked?: boolean;
  yielded?: boolean;
  retention?: RetentionSweepResult;
}

const EMPTY_COUNTS: WhatsAppWorkerCounts = {
  materialized: 0,
  webhooks: 0,
  reminders: 0,
  outbox: 0,
  campaigns: 0,
  campaignRecipients: 0,
};

function emitTickMetric(input: TickMetricInput): void {
  const meta: Record<string, unknown> = {
    event: input.event ?? "whatsapp.worker.tick",
    tickId: input.tickId,
    workerId,
    reason: input.reason,
    phase: input.phase,
    durationMs: input.durationMs ?? 0,
    workFound: input.workFound ?? false,
    counts: input.counts ?? EMPTY_COUNTS,
    windowOpen: input.windowOpen,
    errorCode: input.error?.errorCode ?? null,
    errorName: input.error?.errorName ?? null,
    classification: input.error?.classification ?? "none",
    backoffMs: input.backoffMs ?? 0,
    drainCycle: input.drainCycle ?? 0,
  };
  if (input.blocked) meta.blocked = true;
  if (input.yielded) meta.yielded = true;
  if (input.retention) meta.retention = input.retention;

  if (input.phase === "failed") logger.error("WhatsApp worker tick failed", meta);
  else logger.info("WhatsApp worker tick", meta);
}

function nextBackoffMs(failures: number): number {
  const exponential = Math.min(
    DB_BACKOFF_MAX_MS,
    DB_BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1)
  );
  return exponential + Math.floor(Math.random() * DB_BACKOFF_JITTER_MS);
}

function countsFromResult(result: WhatsAppWorkerRunResult): WhatsAppWorkerCounts {
  return {
    materialized: result.materialized,
    webhooks: result.webhooks,
    reminders: result.reminders,
    outbox: result.outbox,
    campaigns: result.campaigns,
    campaignRecipients: result.campaignRecipients,
  };
}

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
      take: BRANCH_SCAN_LIMIT,
    }),
  ]);
  return [
    ...new Set([
      ...campaignBranches.map((row) => row.branchId),
      ...reminderBranches.map((row) => row.branchId),
    ]),
  ];
}

export async function runWhatsAppWorkerOnce(): Promise<WhatsAppWorkerRunResult> {
  const cfg = getWhatsAppConfig();
  const materialized = await materializeDueCampaigns(CAMPAIGN_MATERIALIZE_LIMIT);
  const webhooks = await processPendingWebhookEvents(WEBHOOK_BATCH_LIMIT);
  const reminders = await processDueReminders(REMINDER_BATCH_LIMIT);
  const outboxLimit = cfg.maxWorkerConcurrency * 5;
  const outbox = await processOutboxBatch(workerId, outboxLimit);

  let campaigns = 0;
  let campaignRecipients = 0;
  let campaignBatchFull = false;
  const branches = await processingBranches();
  for (const branchId of branches) {
    const processed = await processCampaignRecipients(branchId, cfg.maxWorkerConcurrency);
    campaignRecipients += processed;
    if (processed >= cfg.maxWorkerConcurrency) campaignBatchFull = true;
    campaigns += 1;
  }

  const moreWork =
    materialized >= CAMPAIGN_MATERIALIZE_LIMIT ||
    webhooks >= WEBHOOK_BATCH_LIMIT ||
    reminders >= REMINDER_BATCH_LIMIT ||
    outbox >= outboxLimit ||
    branches.length >= BRANCH_SCAN_LIMIT ||
    campaignBatchFull;

  return { outbox, webhooks, reminders, campaigns, campaignRecipients, materialized, moreWork };
}

export function startWhatsAppWorker(): () => void {
  const cfg = getWhatsAppConfig();
  let running = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerReason: WhatsAppWorkerWakeReason | null = null;
  let timerDueAt = 0;
  let pendingReason: WhatsAppWorkerWakeReason | null = null;
  let backoffUntil = 0;
  let transientFailures = 0;
  let drainCycles = 0;
  let tickSequence = 0;
  let retentionTimer: ReturnType<typeof setInterval> | null = null;
  let retentionRunning = false;
  let lastRetentionSweepAt = 0;
  let windowState: boolean | null = null;

  const nextTickId = () => `${workerId}-${++tickSequence}`;

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    timerReason = null;
    timerDueAt = 0;
  }

  function coalescePending(reason: WhatsAppWorkerWakeReason): void {
    if (reason === "fallback" || reason === "backoff" || reason === "retention") return;
    if (!pendingReason) pendingReason = reason;
  }

  function consumePending(): WhatsAppWorkerWakeReason | null {
    const reason = pendingReason;
    pendingReason = null;
    return reason;
  }

  function scheduleTick(reason: WhatsAppWorkerWakeReason, delayMs: number): void {
    if (stopped) return;
    const delay = Math.max(0, delayMs);
    const now = Date.now();

    if (backoffUntil > now && reason !== "backoff") {
      coalescePending(reason);
      return;
    }
    if (running) {
      coalescePending(reason);
      return;
    }

    const dueAt = now + delay;
    if (timer) {
      if (timerReason === "backoff") {
        if (reason !== "backoff") coalescePending(reason);
        return;
      }
      if (reason === "backoff" || dueAt < timerDueAt) {
        clearTimer();
      } else {
        coalescePending(reason);
        return;
      }
    }

    timerReason = reason;
    timerDueAt = dueAt;
    timer = setTimeout(() => {
      const scheduledReason = timerReason ?? "fallback";
      clearTimer();
      if (stopped) return;
      void tick(scheduledReason);
    }, delay);
  }

  function runRetentionSweep(): void {
    if (stopped || retentionRunning) return;
    retentionRunning = true;
    const tickId = nextTickId();
    const startedAt = Date.now();
    const windowOpen = isWorkerWindowOpen(cfg);
    const drainCycle = 0;
    emitTickMetric({ tickId, reason: "retention", phase: "start", windowOpen, drainCycle });

    void purgeExpiredWhatsAppData()
      .then((result) => {
        lastRetentionSweepAt = Date.now();
        emitTickMetric({
          tickId,
          reason: "retention",
          phase: "end",
          windowOpen,
          durationMs: Date.now() - startedAt,
          retention: result,
          drainCycle,
        });
      })
      .catch((err: unknown) => {
        const error = classifyError(err);
        emitTickMetric({
          tickId,
          reason: "retention",
          phase: "failed",
          windowOpen,
          durationMs: Date.now() - startedAt,
          error,
          drainCycle,
        });
        logger.error("WhatsApp retention sweep failed", {
          workerId,
          errorCode: error.errorCode,
          errorName: error.errorName,
          classification: error.classification,
        });
      })
      .finally(() => {
        retentionRunning = false;
      });
  }

  async function tick(reason: WhatsAppWorkerWakeReason): Promise<void> {
    if (stopped) return;
    if (running) {
      coalescePending(reason);
      return;
    }

    const tickId = nextTickId();
    const windowOpen = isWorkerWindowOpen(cfg);
    const startedAt = Date.now();
    const now = startedAt;
    if (backoffUntil > now) {
      const remaining = backoffUntil - now;
      emitTickMetric({
        tickId,
        reason,
        phase: "start",
        windowOpen,
        backoffMs: remaining,
        blocked: true,
        drainCycle: drainCycles,
      });
      emitTickMetric({
        tickId,
        reason,
        phase: "end",
        windowOpen,
        backoffMs: remaining,
        blocked: true,
        drainCycle: drainCycles,
      });
      scheduleTick("backoff", remaining);
      return;
    }

    if (reason !== "drain") drainCycles = 0;
    running = true;
    let counts: WhatsAppWorkerCounts = EMPTY_COUNTS;
    let result: WhatsAppWorkerRunResult | null = null;
    let failure: ClassifiedError | null = null;
    let backoffMs = 0;

    try {
      emitTickMetric({ tickId, reason, phase: "start", windowOpen, drainCycle: drainCycles });
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
        emitTickMetric({
          tickId,
          reason,
          phase: "end",
          windowOpen,
          durationMs: Date.now() - startedAt,
          drainCycle: drainCycles,
        });
        return;
      }

      result = await runWhatsAppWorkerOnce();
      counts = countsFromResult(result);
      transientFailures = 0;
      backoffUntil = 0;
      const workFound =
        counts.materialized > 0 ||
        counts.webhooks > 0 ||
        counts.reminders > 0 ||
        counts.outbox > 0 ||
        counts.campaignRecipients > 0;
      emitTickMetric({
        tickId,
        reason,
        phase: "end",
        windowOpen,
        durationMs: Date.now() - startedAt,
        workFound,
        counts,
        drainCycle: drainCycles,
      });
    } catch (err) {
      failure = classifyError(err);
      if (failure.classification === "transient_db") {
        transientFailures += 1;
        backoffMs = nextBackoffMs(transientFailures);
        backoffUntil = Date.now() + backoffMs;
      }
      emitTickMetric({
        tickId,
        reason,
        phase: "failed",
        windowOpen,
        durationMs: Date.now() - startedAt,
        counts,
        error: failure,
        backoffMs,
        drainCycle: drainCycles,
      });
    } finally {
      running = false;
    }

    if (stopped) return;

    if (failure) {
      if (failure.classification === "transient_db") scheduleTick("backoff", backoffMs);
      else scheduleTick("fallback", cfg.workerPollMs);
      return;
    }

    const pending = consumePending();
    if (pending) {
      scheduleTick(pending, WAKE_DELAY_MS);
      return;
    }
    if (!result || !windowOpen || !result.moreWork) {
      drainCycles = 0;
      scheduleTick("fallback", cfg.workerPollMs);
      return;
    }
    if (drainCycles < MAX_DRAIN_CYCLES) {
      drainCycles += 1;
      scheduleTick("drain", DRAIN_DELAY_MS);
      return;
    }

    emitTickMetric({
      tickId,
      reason: "drain",
      phase: "end",
      event: "whatsapp.worker.drain.yield",
      windowOpen,
      durationMs: Date.now() - startedAt,
      workFound: true,
      counts,
      yielded: true,
      drainCycle: drainCycles,
    });
    drainCycles = 0;
    scheduleTick("fallback", cfg.workerPollMs);
  }

  logger.info("WhatsApp worker started", {
    workerId,
    provider: cfg.provider,
    mode: "event-driven",
    fallbackPollMs: cfg.workerPollMs,
    concurrency: cfg.maxWorkerConcurrency,
    sendEnabled: cfg.sendEnabled,
    campaignSendEnabled: cfg.campaignSendEnabled,
  });

  const unregisterWake = onWhatsAppWorkerWake((wakeReason) => {
    if (stopped) return;
    scheduleTick(wakeReason, WAKE_DELAY_MS);
  });

  void runRetentionSweep();
  scheduleTick("startup", 0);

  retentionTimer = setInterval(() => {
    if (stopped || retentionRunning) return;
    if (Date.now() - lastRetentionSweepAt < RETENTION_SWEEP_INTERVAL_MS) return;
    void runRetentionSweep();
  }, RETENTION_SWEEP_INTERVAL_MS);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    pendingReason = null;
    clearTimer();
    if (retentionTimer) {
      clearInterval(retentionTimer);
      retentionTimer = null;
    }
    unregisterWake();
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    logger.info("WhatsApp worker stopped", { workerId });
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return stop;
}
