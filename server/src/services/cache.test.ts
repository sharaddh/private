import { describe, it, expect, vi, beforeEach } from "vitest";

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));

vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info,
    warn,
    error: vi.fn(),
    audit: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock("ioredis", () => {
  class FakeRedis {
    status = "ready";
    handlers: Record<string, (() => void)[]> = {};

    on(event: string, cb: () => void) {
      (this.handlers[event] ||= []).push(cb);
      return this;
    }

    emit(event: string) {
      (this.handlers[event] || []).forEach((cb) => cb());
    }

    async get() {
      throw new Error("get failed");
    }

    async setex() {
      throw new Error("set failed");
    }

    async scan() {
      throw new Error("scan failed");
    }

    pipeline() {
      return { del: () => undefined, exec: async () => [] };
    }

    async quit() {
      this.status = "end";
    }
  }

  return { default: FakeRedis };
});

import {
  initCache,
  destroyCache,
  isConnected,
  cacheGet,
  cacheSet,
  cacheDel,
  recordCacheMetric,
  getCacheMetrics,
} from "./cache";

interface FakeRedisLike {
  emit(event: string): void;
}

describe("cache metrics", () => {
  beforeEach(() => {
    info.mockClear();
    warn.mockClear();
  });

  it("records sanitized counters and no sensitive details", () => {
    const before = getCacheMetrics();

    recordCacheMetric("HIT");
    recordCacheMetric("MISS");
    recordCacheMetric("BYPASS");
    recordCacheMetric("INVALIDATION", "explicit");
    recordCacheMetric("ERROR", "get");
    recordCacheMetric("HIT", "branch:/api/orders?phone=9999999999&token=secret" as never);

    const after = getCacheMetrics();
    expect(after.HIT - before.HIT).toBe(2);
    expect(after.MISS - before.MISS).toBe(1);
    expect(after.BYPASS - before.BYPASS).toBe(1);
    expect(after.INVALIDATION - before.INVALIDATION).toBe(1);
    expect(after.ERROR - before.ERROR).toBe(1);

    for (const call of info.mock.calls) {
      expect(call[0]).toBe("cache.metric");
      const payload = call[1] as Record<string, unknown>;
      expect(payload.event).toBe("cache.metric");
      expect(Object.keys(payload).every((key) => ["event", "kind", "detail"].includes(key))).toBe(
        true
      );
    }

    const serialized = JSON.stringify(info.mock.calls);
    for (const forbidden of ["phone", "9999999999", "token", "secret", "branch:"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("records cache failures without logging keys or values", async () => {
    const client = initCache("redis://unused") as unknown as FakeRedisLike;
    client.emit("connect");
    client.emit("ready");
    expect(isConnected()).toBe(true);

    const before = getCacheMetrics();
    await cacheGet("secret-key");
    await cacheSet("secret-key", "secret-value");
    await cacheDel("secret-pattern");
    const after = getCacheMetrics();

    expect(after.ERROR - before.ERROR).toBeGreaterThanOrEqual(2);
    const serialized = JSON.stringify(info.mock.calls);
    for (const forbidden of ["secret-key", "secret-value", "secret-pattern"]) {
      expect(serialized).not.toContain(forbidden);
    }

    await destroyCache();
    expect(isConnected()).toBe(false);
  });
});
