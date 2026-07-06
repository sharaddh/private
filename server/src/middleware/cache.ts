import { Request, Response, NextFunction } from "express";
import { cacheGet, cacheSet, cacheDel } from "../services/cache";

function branchKey(req: Request): string {
  const branchId = req.headers["x-branch-id"] as string || req.query._branch as string || "default";
  return branchId;
}

export function cacheRoute(ttlSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    const key = `${branchKey(req)}:${req.originalUrl}`;
    const cached = await cacheGet<{ body: unknown; status: number }>(key);
    if (cached) {
      res.set("x-cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }

    res.set("x-cache", "MISS");
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
  await cacheDel(pattern);
  // Also invalidate dashboard since most mutations affect it
  if (!pattern.includes("/dashboard")) {
    await cacheDel("*:/api/dashboard*");
  }
}
