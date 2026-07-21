import Redis from "ioredis";
import { logger } from "../utils/logger";

export const CACHE_PREFIX = "route:";
const DEFAULT_TTL = 60;
const SCAN_COUNT = 100;

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

  client.on("connect", () => { connected = true; });
  client.on("ready", () => { logger.info("Redis ready for cache operations"); });
  client.on("close", () => { connected = false; });
  client.on("reconnecting", () => {});
  client.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) return;
    if (process.env.NODE_ENV !== "production") console.warn("Redis:", err.message);
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
  } catch (e) { /* scan failure is non-fatal */ }
  return keys;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null;
  try {
    const raw = await client!.get(prefixed(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isConnected()) return;
  const value = typeof data === "string" ? data : JSON.stringify(data);
  try {
    await client!.setex(prefixed(key), ttl, value);
  } catch (e) { /* set failure is non-fatal */ }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected()) return;
  try {
    // Match all branch variants (e.g. "branchId:/api/customers/..." or "default:/api/customers/...")
    const branchPattern = pattern.startsWith("*:") ? pattern : `*:${pattern}`;
    const keys = await scanKeys(branchPattern);
    if (keys.length > 0) {
      const pipeline = client!.pipeline();
      keys.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
  } catch (e) { /* del failure is non-fatal */ }
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
