import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

export function signAccess(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken<T = any>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}
