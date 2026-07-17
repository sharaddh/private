import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import type { JwtPayload, AuthRequest } from "../types";

export { JwtPayload, AuthRequest } from "../types";

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  const token = header.split(" ")[1];
  try {
    const payload = verifyToken<JwtPayload>(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role || "")) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    next();
  };
}
