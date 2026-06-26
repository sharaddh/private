import Redis from "ioredis";

const DEFAULT_TTL = 60;

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
  });

  client.on("connect", () => { connected = true; console.log("Redis connected"); });
  client.on("close", () => { connected = false; });
  client.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) return;
    console.warn("Redis error:", err.message);
  });

  return client;
}

export function getClient(): Redis | null {
  return client;
}

export function isConnected(): boolean {
  return connected && client !== null && client.status === "ready";
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null;
  try {
    const raw = await client!.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isConnected()) return;
  try {
    await client!.setex(key, ttl, JSON.stringify(data));
  } catch {}
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected()) return;
  try {
    const keys = await client!.keys(pattern);
    if (keys.length > 0) await client!.del(...keys);
  } catch {}
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  if (!isConnected()) return [];
  try {
    return await client!.keys(pattern);
  } catch {
    return [];
  }
}
