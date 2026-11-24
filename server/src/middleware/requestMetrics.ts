import { Request, Response, NextFunction } from "express";
import type { BranchRequest } from "../types";
import { getCtx } from "../utils/requestContext";
import { logger } from "../utils/logger";

const INSTANCE_ID = process.env.HOSTNAME || process.env.RENDER_INSTANCE_ID || "local";
const DEFAULT_SLOW_REQUEST_MS = 1000;

type CacheStatus = "HIT" | "MISS" | "BYPASS";

interface HttpRequestMetrics {
  [key: string]: unknown;
  event: "http.request";
  route_template: string;
  method: string;
  status: number;
  duration_ms: number;
  response_bytes: number;
  request_id?: string;
  branch_id?: string;
  cache_status: CacheStatus;
  instance_id: string;
}

function getRouteTemplate(req: Request): string {
  const baseUrl = typeof req.baseUrl === "string" ? req.baseUrl : "";
  const routePath = req.route?.path;
  const path = typeof routePath === "string" ? routePath : routePath ? String(routePath) : "";
  return `${baseUrl}${path}` || "unmatched";
}

function getCacheStatus(res: Response): CacheStatus {
  const header = res.getHeader("x-cache");
  const value = Array.isArray(header) ? header[0] : header;
  const status = typeof value === "string" ? value.toUpperCase() : "";
  return status === "HIT" || status === "MISS" ? status : "BYPASS";
}

function chunkBytes(chunk: unknown, encoding?: unknown): number {
  try {
    if (typeof chunk === "string") {
      return Buffer.byteLength(
        chunk,
        typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8"
      );
    }
    if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) return chunk.length;
    return 0;
  } catch {
    return 0;
  }
}

export function createRequestMetrics(slowRequestMs = DEFAULT_SLOW_REQUEST_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    let responseBytes = 0;
    let template: string | undefined;

    const captureRoute = () => {
      if (!template) template = getRouteTemplate(req);
    };

    const originalWrite = res.write.bind(res) as (
      chunk: unknown,
      encoding?: unknown,
      callback?: unknown
    ) => boolean;
    res.write = function (chunk: unknown, encoding?: unknown, callback?: unknown) {
      captureRoute();
      responseBytes += chunkBytes(chunk, encoding);
      return originalWrite(chunk, encoding, callback);
    } as typeof res.write;

    const originalEnd = res.end.bind(res) as (
      chunk?: unknown,
      encoding?: unknown,
      callback?: unknown
    ) => typeof res;
    res.end = function (chunk?: unknown, encoding?: unknown, callback?: unknown) {
      captureRoute();
      const before = responseBytes;
      const bytes = chunkBytes(chunk, encoding);
      const result = originalEnd(chunk, encoding, callback);
      if (responseBytes === before && bytes > 0) responseBytes += bytes;
      return result;
    } as typeof res.end;

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const routeTemplate = template ?? getRouteTemplate(req);
      const context = getCtx();
      const metrics: HttpRequestMetrics = {
        event: "http.request",
        route_template: routeTemplate,
        method: req.method,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 1000) / 1000,
        response_bytes: responseBytes,
        request_id: context?.requestId ?? (req.headers["x-request-id"] as string | undefined),
        branch_id: (req as BranchRequest).branchId ?? context?.branchId,
        cache_status: getCacheStatus(res),
        instance_id: INSTANCE_ID,
      };
      logger.info("http.request", metrics);
      if (durationMs > slowRequestMs) {
        logger.warn("Slow request", {
          method: req.method,
          route_template: routeTemplate,
          durationMs: Math.round(durationMs),
        });
      }
    });

    next();
  };
}

export const requestMetrics = createRequestMetrics();
