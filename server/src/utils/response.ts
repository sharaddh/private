import { Response } from "express";
import { logger } from "./logger";

// Prisma stores the Mongo-compatible identifier on the `id` field (column `_id`).
// The client-facing API exposes it as `_id`, so we map it centrally here.
export function serializeIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializeIds);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = { ...obj };
    if (typeof obj.id === "string" && !("_id" in obj)) {
      out._id = obj.id;
    }
    for (const key of Object.keys(out)) {
      const child = out[key];
      if (child && typeof child === "object") {
        out[key] = serializeIds(child);
      }
    }
    return out;
  }
  return value;
}

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200): void {
  const body: Record<string, unknown> = { success: true, data: serializeIds(data) };
  if (message) body.message = message;
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = "Created successfully"): void {
  sendSuccess(res, data, message, 201);
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  extra?: Record<string, unknown>
): void {
  const body: Record<string, unknown> = { success: false, message };
  if (extra) Object.assign(body, extra);
  res.status(status).json(body);
}

export function sendNotFound(res: Response, message = "Resource not found"): void {
  sendError(res, message, 404);
}

export function sendServerError(res: Response, error: unknown): void {
  logger.error("Internal server error", { error: (error as Error).message });
  sendError(res, "Internal Server Error", 500);
}
