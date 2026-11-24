import { Request, Response, NextFunction } from "express";
import { cacheGet, cacheSet, cacheDel, isConnected, recordCacheMetric } from "../services/cache";
import type { BranchRequest } from "../types";

const VOLATILE_PARAMS = ["_t", "t", "timestamp", "nonce", "cacheBust"];

function compareParams(a: [string, string], b: [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

function canonicalizePath(path: string): string {
  const separator = path.indexOf("?");
  if (separator === -1) return path;
  const pathname = path.slice(0, separator);
  const query = path.slice(separator + 1);
  const params = Array.from(new URLSearchParams(query).entries())
    .filter(([key]) => !VOLATILE_PARAMS.includes(key))
    .sort(compareParams);
  const canonicalQuery = new URLSearchParams(params).toString();
  return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname;
}

function cacheKey(req: Request): string {
  const user = (req as BranchRequest).user;
  const branchId =
    (req as BranchRequest).branchId ||
    (req.headers["x-branch-id"] as string) ||
    (req.query._branch as string) ||
    "default";
  const path = canonicalizePath(req.originalUrl);
  return `${user?.sub || "anon"}:${user?.role || "none"}:${branchId}:${path}`;
}

export function cacheRoute(ttlSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || !isConnected()) {
      res.set("x-cache", "BYPASS");
      recordCacheMetric("BYPASS");
      return next();
    }

    const key = cacheKey(req);
    let cached: { body: unknown; status: number } | null;
    try {
      cached = await cacheGet<{ body: unknown; status: number }>(key);
    } catch {
      res.set("x-cache", "BYPASS");
      recordCacheMetric("BYPASS");
      return next();
    }
    if (cached) {
      res.set("x-cache", "HIT");
      recordCacheMetric("HIT");
      res.set("Cache-Control", "private, max-age=30");
      return res.status(cached.status).json(cached.body);
    }

    res.set("x-cache", "MISS");
    recordCacheMetric("MISS");
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode < 400) {
        cacheSet(key, { body, status: res.statusCode }, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

export async function invalidateCache(pattern: string): Promise<void> {
  const canonical = canonicalizePath(pattern);
  await cacheDel(canonical);
  recordCacheMetric("INVALIDATION", "explicit");
  if (!canonical.includes("/dashboard")) {
    await cacheDel("*:/api/dashboard*");
    recordCacheMetric("INVALIDATION", "dashboard");
  }
}
