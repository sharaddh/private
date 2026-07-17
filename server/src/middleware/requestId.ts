import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = id;
  _res.setHeader("x-request-id", id);
  next();
}
