import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { logger } from "../utils/logger";

export function audit(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const authReq = req as AuthRequest;
  logger.audit({
    method: req.method,
    path: req.originalUrl,
    userId: authReq.user?.sub,
    username: authReq.user?.username,
    ip: req.ip,
    requestId: req.headers["x-request-id"] as string,
  });
  next();
}
