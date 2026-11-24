import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getWhatsAppConfig, isWorkerWindowOpen } from "./config";

const envKeys = [
  "WHATSAPP_WORKER_POLL_MS",
  "WHATSAPP_MAX_WORKER_CONCURRENCY",
  "WHATSAPP_WORKER_WINDOW_ENABLED",
  "WHATSAPP_WORKER_WINDOW_START",
  "WHATSAPP_WORKER_WINDOW_END",
  "WHATSAPP_WORKER_TIMEZONE",
] as const;

let originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
});

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("getWhatsAppConfig", () => {
  it("keeps the slow fallback default and concurrency default", () => {
    const cfg = getWhatsAppConfig();
    expect(cfg.workerPollMs).toBe(15 * 60 * 1000);
    expect(cfg.maxWorkerConcurrency).toBe(1);
    expect(cfg.workerWindowEnabled).toBe(false);
  });

  it("clamps an explicitly short fallback poll to the slow minimum", () => {
    process.env.WHATSAPP_WORKER_POLL_MS = "1000";
    expect(getWhatsAppConfig().workerPollMs).toBe(30_000);
  });
});

describe("isWorkerWindowOpen", () => {
  it("reports an open window without configuration", () => {
    expect(isWorkerWindowOpen(getWhatsAppConfig(), new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });

  it("detects a closed configured window", () => {
    process.env.WHATSAPP_WORKER_WINDOW_ENABLED = "true";
    process.env.WHATSAPP_WORKER_WINDOW_START = "0";
    process.env.WHATSAPP_WORKER_WINDOW_END = "1";
    process.env.WHATSAPP_WORKER_TIMEZONE = "UTC";
    const cfg = getWhatsAppConfig();
    expect(isWorkerWindowOpen(cfg, new Date("2026-01-01T00:30:00Z"))).toBe(true);
    expect(isWorkerWindowOpen(cfg, new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });
});
