import Redis from "ioredis";
import { logger } from "../utils/logger";

export const CACHE_PREFIX = "route:";
const DEFAULT_TTL = 60;
const SCAN_COUNT = 100;

type CacheMetricKind = "HIT" | "MISS" | "BYPASS" | "INVALIDATION" | "ERROR";
type CacheMetricDetail = "explicit" | "dashboard" | "get" | "set" | "del" | "scan";

const CACHE_METRIC_KINDS: CacheMetricKind[] = ["HIT", "MISS", "BYPASS", "INVALIDATION", "ERROR"];
const CACHE_METRIC_DETAILS: CacheMetricDetail[] = [
  "explicit",
  "dashboard",
  "get",
  "set",
  "del",
  "scan",
];
const cacheCounters: Record<CacheMetricKind, number> = {
  HIT: 0,
  MISS: 0,
  BYPASS: 0,
  INVALIDATION: 0,
  ERROR: 0,
};

export function recordCacheMetric(kind: CacheMetricKind, detail?: CacheMetricDetail): void {
  if (!CACHE_METRIC_KINDS.includes(kind)) return;
  const safeDetail = detail && CACHE_METRIC_DETAILS.includes(detail) ? detail : undefined;
  cacheCounters[kind] += 1;
  logger.info("cache.metric", {
    event: "cache.metric",
    kind,
    ...(safeDetail ? { detail: safeDetail } : {}),
  });
}

export function getCacheMetrics(): Readonly<Record<CacheMetricKind, number>> {
  return { ...cacheCounters };
}

let client: Redis | null = null;
let connected = false;

export function initCache(redisUrl: string): Redis {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    connected = true;
  });
  client.on("ready", () => {
    logger.info("Redis ready for cache operations");
  });
  client.on("close", () => {
    connected = false;
  });
  client.on("reconnecting", () => {});
  client.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) return;
    if (process.env.NODE_ENV !== "production") logger.warn(`Redis: ${err.message}`);
  });

  return client;
}

export function getClient(): Redis | null {
  return client;
}

export function isConnected(): boolean {
  return connected && client !== null && client.status === "ready";
}

export async function destroyCache(): Promise<void> {
  if (client) {
    connected = false;
    await client.quit();
    client = null;
  }
}

function prefixed(key: string) {
  return key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`;
}

async function scanKeys(pattern: string): Promise<string[]> {
  if (!isConnected()) return [];
  const fullPattern = prefixed(pattern);
  const keys: string[] = [];
  let cursor = "0";
  try {
    do {
      const result = await client!.scan(cursor, "MATCH", fullPattern, "COUNT", SCAN_COUNT);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");
  } catch {
    recordCacheMetric("ERROR", "scan");
  }
  return keys;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null;
  try {
    const raw = await client!.get(prefixed(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    recordCacheMetric("ERROR", "get");
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isConnected()) return;
  const value = typeof data === "string" ? data : JSON.stringify(data);
  try {
    await client!.setex(prefixed(key), ttl, value);
  } catch {
    recordCacheMetric("ERROR", "set");
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected()) return;
  try {
    // Match all branch variants (e.g. "branchId:/api/customers/..." or "default:/api/customers/...").
    // Cache keys include the full query string (branchId:/api/orders?limit=10&...), so append a
    // trailing wildcard unless already present, otherwise glob misses query-string keys entirely.
    const branchPattern = pattern.startsWith("*:") ? pattern : `*:${pattern}`;
    const glob = branchPattern.endsWith("*") ? branchPattern : `${branchPattern}*`;
    const keys = await scanKeys(glob);
    if (keys.length > 0) {
      const pipeline = client!.pipeline();
      keys.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
  } catch {
    recordCacheMetric("ERROR", "del");
  }
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  if (!isConnected()) return [];
  try {
    return await scanKeys(pattern);
  } catch {
    return [];
  }
}

export async function cacheFlushAll(): Promise<number> {
  if (!isConnected()) return 0;
  try {
    const keys = await scanKeys("*");
    if (keys.length > 0) {
      const pipeline = client!.pipeline();
      keys.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
    return keys.length;
  } catch {
    return 0;
  }
}
