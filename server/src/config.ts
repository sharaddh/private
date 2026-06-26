import dotenv from "dotenv";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const MONGO_URI = process.env.MONGO_URI || "";
export const JWT_SECRET = process.env.JWT_SECRET || "change_this";
export const REDIS_URL = process.env.REDIS_URL || "";

export const CACHE_TTL = {
  DASHBOARD: 30,
  CUSTOMERS: 60,
  INVENTORY: 60,
  ORDERS: 30,
  BILLS: 30,
  DEFAULT: 60,
} as const;
