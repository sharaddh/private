import { Request, Response, NextFunction } from "express";

export function audit(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const entry = {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    user: user ? { id: user.sub, username: user.username } : null,
    ip: req.ip
  };
  // For now log to console; replace with DB/file logger in production
  console.log("AUDIT:", JSON.stringify(entry));
  next();
}
