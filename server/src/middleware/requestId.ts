import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const REQUEST_ID_HEADER = "x-request-id";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[REQUEST_ID_HEADER] as string | undefined;
  const id = (existing && existing.trim()) || crypto.randomUUID();
  req.headers[REQUEST_ID_HEADER] = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
