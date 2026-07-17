import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200): void {
  const body: Record<string, unknown> = { success: true, data };
  if (message) body.message = message;
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = "Created successfully"): void {
  sendSuccess(res, data, message, 201);
}

export function sendError(res: Response, message: string, status = 400, extra?: Record<string, unknown>): void {
  const body: Record<string, unknown> = { success: false, message };
  if (extra) Object.assign(body, extra);
  res.status(status).json(body);
}

export function sendNotFound(res: Response, message = "Resource not found"): void {
  sendError(res, message, 404);
}

export function sendServerError(res: Response, error: unknown): void {
  console.error(error);
  sendError(res, "Internal Server Error", 500);
}
