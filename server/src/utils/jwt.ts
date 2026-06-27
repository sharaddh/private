import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, NODE_ENV } from "../config";

const SECRET = JWT_SECRET || (NODE_ENV === "production" ? "" : "dev-secret-not-for-production");

export function signAccess(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"] });
}

export function verifyToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
