import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: any;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Unauthorized" });
  const token = header.split(" ")[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}
