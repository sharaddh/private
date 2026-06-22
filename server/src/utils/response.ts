import { Response } from "express";

export function success(res: Response, data: unknown, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created(res: Response, data: unknown, message = "Created successfully") {
  return success(res, data, message, 201);
}

export function fail(res: Response, message: string, status = 400, extra?: Record<string, unknown>) {
  return res.status(status).json({ success: false, message, ...extra });
}

export function notFound(res: Response, message = "Resource not found") {
  return fail(res, message, 404);
}

export function serverError(res: Response, error: unknown) {
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
}
