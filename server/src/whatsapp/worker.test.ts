import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../utils/logger";
import { prisma } from "../db/prisma";
import { materializeDueCampaigns, processCampaignRecipients } from "./campaign";
import { processOutboxBatch } from "./outbox";
import { processDueReminders } from "./reminders";
import { purgeExpiredWhatsAppData, RETENTION_SWEEP_INTERVAL_MS } from "./retention";
import { processPendingWebhookEvents } from "./webhook";
import { requestWhatsAppWorkerTick } from "./wake";
import { DB_BACKOFF_BASE_MS, startWhatsAppWorker } from "./worker";

vi.mock("../utils/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), audit: vi.fn() },
}));

vi.mock("../db/prisma", () => ({
  prisma: {
    whatsAppCampaign: { groupBy: vi.fn() },
    whatsAppReminder: { findMany: vi.fn() },
  },
}));

vi.mock("./campaign", () => ({
  materializeDueCampaigns: vi.fn(),
  processCampaignRecipients: vi.fn(),
}));

vi.mock("./outbox", () => ({ processOutboxBatch: vi.fn() }));

vi.mock("./reminders", () => ({ processDueReminders: vi.fn() }));

vi.mock("./webhook", () => ({ processPendingWebhookEvents: vi.fn() }));

vi.mock("./retention", () => ({
  purgeExpiredWhatsAppData: vi.fn(),
  RETENTION_SWEEP_INTERVAL_MS: 24 * 60 * 60 * 1000,
}));

const envKeys = [
  "WHATSAPP_WORKER_POLL_MS",
  "WHATSAPP_MAX_WORKER_CONCURRENCY",
  "WHATSAPP_WORKER_WINDOW_ENABLED",
  "WHATSAPP_WORKER_WINDOW_START",
  "WHATSAPP_WORKER_WINDOW_END",
  "WHATSAPP_WORKER_TIMEZONE",
] as const;

const emptyRetention = {
  branches: 0,
  messages: 0,
  outbox: 0,
  webhookEvents: 0,
  reminders: 0,
};

type Meta = Record<string, unknown>;

let originalEnv: Record<string, string | undefined> = {};
let stops: Array<() => void> = [];

function startWorker(): () => void {
  const stop = startWhatsAppWorker();
  stops.push(stop);
  return stop;
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

function metrics(phase: string, reason?: string, event = "whatsapp.worker.tick"): Meta[] {
  const calls = [
    ...vi.mocked(logger.info).mock.calls,
    ...vi.mocked(logger.error).mock.calls,
  ] as Array<[string, Meta?]>;
  return calls
    .map(([, meta]) => meta)
    .filter(
      (meta): meta is Meta =>
        meta !== undefined &&
        meta.event === event &&
        meta.phase === phase &&
        (!reason || meta.reason === reason)
    );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.WHATSAPP_WORKER_POLL_MS = "30000";
  process.env.WHATSAPP_MAX_WORKER_CONCURRENCY = "1";
  for (const key of envKeys.slice(2)) delete process.env[key];
  stops = [];

  vi.clearAllMocks();
  vi.mocked(prisma.whatsAppCampaign.groupBy).mockReset().mockResolvedValue([]);
  vi.mocked(prisma.whatsAppReminder.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(materializeDueCampaigns).mockReset().mockResolvedValue(0);
  vi.mocked(processCampaignRecipients).mockReset().mockResolvedValue(0);
  vi.mocked(processOutboxBatch).mockReset().mockResolvedValue(0);
  vi.mocked(processDueReminders).mockReset().mockResolvedValue(0);
  vi.mocked(processPendingWebhookEvents).mockReset().mockResolvedValue(0);
  vi.mocked(purgeExpiredWhatsAppData).mockReset().mockResolvedValue(emptyRetention);
});

afterEach(() => {
  for (const stop of stops) stop();
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("startWhatsAppWorker scheduler", () => {
  it("runs exactly one startup tick", async () => {
    startWorker();
    await advance(0);

    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    expect(metrics("start", "startup")).toHaveLength(1);
    expect(metrics("end", "startup")).toHaveLength(1);
    expect(metrics("start", "startup")[0]).toMatchObject({
      reason: "startup",
      windowOpen: true,
      workFound: false,
      backoffMs: 0,
      drainCycle: 0,
      counts: {
        materialized: 0,
        webhooks: 0,
        reminders: 0,
        outbox: 0,
        campaigns: 0,
        campaignRecipients: 0,
      },
    });
  });

  it("coalesces wakes while a tick is running without overlapping", async () => {
    let release!: () => void;
    const pending = new Promise<number>((resolve) => {
      release = () => resolve(0);
    });
    vi.mocked(materializeDueCampaigns).mockImplementationOnce(() => pending);
    startWorker();

    await advance(0);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    requestWhatsAppWorkerTick("wake:event");
    requestWhatsAppWorkerTick("wake:webhook");
    await advance(10_000);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);

    release();
    await advance(0);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    await advance(250);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(2);

    const reasons = metrics("start").map((meta) => meta.reason);
    expect(reasons).toContain("wake:event");
    expect(reasons).not.toContain("wake:webhook");
  });

  it("bounds drain cycles and yields with a structured event", async () => {
    vi.mocked(processOutboxBatch).mockResolvedValue(25);
    startWorker();

    await advance(0);
    expect(processOutboxBatch).toHaveBeenCalledTimes(1);
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await advance(1000);
      expect(processOutboxBatch).toHaveBeenCalledTimes(1 + cycle);
      expect(metrics("start", "drain")).toHaveLength(cycle);
    }

    const yieldEvents = metrics("end", "drain", "whatsapp.worker.drain.yield");
    expect(yieldEvents).toHaveLength(1);
    expect(yieldEvents[0]).toMatchObject({
      reason: "drain",
      phase: "end",
      workFound: true,
      yielded: true,
      drainCycle: 3,
    });

    await advance(1000);
    expect(processOutboxBatch).toHaveBeenCalledTimes(4);
    await advance(29_000);
    expect(processOutboxBatch).toHaveBeenCalledTimes(5);
    await advance(1000);
    expect(processOutboxBatch).toHaveBeenCalledTimes(6);
  });

  it("backs off on P1001 and coalesces wakes until the deadline", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const error = Object.assign(new Error("secret connection detail"), {
      name: "PrismaClientInitializationError",
      code: "P1001",
    });
    vi.mocked(materializeDueCampaigns).mockRejectedValueOnce(error);
    startWorker();

    await advance(0);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    const failure = metrics("failed", "startup")[0];
    expect(failure).toMatchObject({
      errorCode: "P1001",
      errorName: "PrismaClientInitializationError",
      classification: "transient_db",
      backoffMs: DB_BACKOFF_BASE_MS,
    });
    expect(JSON.stringify(failure)).not.toContain("secret connection detail");

    await advance(DB_BACKOFF_BASE_MS - 1);
    requestWhatsAppWorkerTick("wake:event");
    await advance(1);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(2);
    expect(metrics("start", "backoff")).toHaveLength(1);

    await advance(250);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(3);
    expect(metrics("start", "wake:event")).toHaveLength(1);
  });

  it("resets backoff after a successful tick", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const error = Object.assign(new Error("db unavailable"), { code: "P1001" });
    vi.mocked(materializeDueCampaigns).mockRejectedValueOnce(error);
    startWorker();

    await advance(0);
    await advance(DB_BACKOFF_BASE_MS);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(2);

    requestWhatsAppWorkerTick("wake:webhook");
    await advance(249);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(3);
    expect(metrics("start", "backoff")).toHaveLength(1);
  });

  it("does not apply database backoff to non-database errors", async () => {
    vi.mocked(materializeDueCampaigns).mockRejectedValueOnce(new Error("secret stack detail"));
    startWorker();

    await advance(0);
    const failure = metrics("failed", "startup")[0];
    expect(failure).toMatchObject({ classification: "other", backoffMs: 0 });
    expect(failure.errorCode).toBeNull();
    expect(JSON.stringify(failure)).not.toContain("secret stack detail");
    expect(metrics("start", "backoff")).toHaveLength(0);

    requestWhatsAppWorkerTick("wake:event");
    await advance(250);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(2);
  });

  it("performs no work while the configured window is closed", async () => {
    process.env.WHATSAPP_WORKER_WINDOW_ENABLED = "true";
    process.env.WHATSAPP_WORKER_WINDOW_START = "0";
    process.env.WHATSAPP_WORKER_WINDOW_END = "1";
    process.env.WHATSAPP_WORKER_TIMEZONE = "UTC";
    startWorker();

    await advance(0);
    expect(materializeDueCampaigns).not.toHaveBeenCalled();
    expect(metrics("end", "startup")[0]).toMatchObject({ windowOpen: false, workFound: false });

    await advance(30_000);
    expect(materializeDueCampaigns).not.toHaveBeenCalled();
  });

  it("keeps retention on its own timer and does not let failures block webhook work", async () => {
    process.env.WHATSAPP_WORKER_POLL_MS = "3600000";
    const error = Object.assign(new Error("secret query detail"), { code: "P1001" });
    vi.mocked(purgeExpiredWhatsAppData).mockRejectedValueOnce(error);
    startWorker();

    await advance(0);
    expect(purgeExpiredWhatsAppData).toHaveBeenCalledTimes(1);
    const retentionFailure = metrics("failed", "retention")[0];
    expect(retentionFailure).not.toBeUndefined();
    expect(retentionFailure).toMatchObject({
      errorCode: "P1001",
      errorName: "Error",
      classification: "transient_db",
    });
    expect(JSON.stringify(retentionFailure)).not.toContain("secret query detail");
    expect(metrics("failed", "startup")).toHaveLength(0);

    requestWhatsAppWorkerTick("wake:webhook");
    await advance(250);
    expect(processPendingWebhookEvents).toHaveBeenCalledTimes(2);

    await advance(RETENTION_SWEEP_INTERVAL_MS);
    expect(purgeExpiredWhatsAppData).toHaveBeenCalledTimes(2);
  });

  it("stops idempotently and prevents further scheduling", async () => {
    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");
    const stop = startWorker();

    await advance(0);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    stop();
    stop();

    expect(process.listenerCount("SIGINT")).toBe(sigintBefore);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore);
    requestWhatsAppWorkerTick("wake:event");
    await advance(120_000);
    expect(materializeDueCampaigns).toHaveBeenCalledTimes(1);
    expect(purgeExpiredWhatsAppData).toHaveBeenCalledTimes(1);
  });
});
