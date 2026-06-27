import dotenv from "dotenv";

dotenv.config();

export const PORT = normalizePort(process.env.PORT || "4000");
export const MONGO_URI = process.env.MONGO_URI || "";
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
export const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
export const REDIS_URL = process.env.REDIS_URL || "";
export const NODE_ENV = process.env.NODE_ENV || "development";

export const CACHE_TTL = {
  DASHBOARD: 30,
  CUSTOMERS: 60,
  INVENTORY: 60,
  ORDERS: 30,
  BILLS: 30,
  DEFAULT: 60,
} as const;

function normalizePort(val: string): number {
  const port = parseInt(val, 10);
  if (isNaN(port)) return 4000;
  if (port >= 0) return port;
  return 4000;
}

if (!JWT_SECRET && NODE_ENV === "production") {
  console.error("JWT_SECRET must be set in production");
  process.exit(1);
}
