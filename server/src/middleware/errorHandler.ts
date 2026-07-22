import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = `ERR_${statusCode}`;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(400, message, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(401, message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(403, message);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(404, message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, message);
  }

  static tooMany(message = "Too many requests"): AppError {
    return new AppError(429, message);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.headers["x-request-id"] as string;

  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      statusCode: err.statusCode,
      code: err.code,
      path: req.originalUrl,
      method: req.method,
      requestId,
    });
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details || {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    const messages = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    logger.warn("Validation error", {
      errors: messages,
      path: req.originalUrl,
      requestId,
    });
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: messages,
    });
    return;
  }

  if (err.name === "ValidationError") {
    logger.warn("Mongoose validation error", { message: err.message, path: req.originalUrl, requestId });
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  if (err.name === "CastError") {
    res.status(400).json({ success: false, message: "Invalid ID format" });
    return;
  }

  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern || {}).join(", ");
    res.status(409).json({
      success: false,
      message: `Duplicate entry${field ? ` for field: ${field}` : ""}`,
    });
    return;
  }

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    requestId,
  });

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
  });
}
