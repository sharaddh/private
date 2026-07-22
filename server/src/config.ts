import dotenv from "dotenv";

dotenv.config();

export const PORT = normalizePort(process.env.PORT || "4000");
export const MONGO_URI = process.env.MONGO_URI || "";
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
export const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
export const REDIS_URL = process.env.REDIS_URL || "";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["https://kmjoptical.onrender.com", "http://localhost:5173", "http://localhost:4000", "http://localhost:5174"];

export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
export const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "200", 10);
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";

function normalizePort(val: string): number {
  const port = parseInt(val, 10);
  if (isNaN(port)) return 4000;
  if (port >= 0) return port;
  return 4000;
}

const requiredInProd: Array<{ name: string; value: string }> = [
  { name: "JWT_SECRET", value: JWT_SECRET },
  { name: "MONGO_URI", value: MONGO_URI },
];

if (NODE_ENV === "production") {
  const missing = requiredInProd.filter((r) => !r.value);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
}

if (!JWT_SECRET && NODE_ENV !== "production") {
  console.warn("JWT_SECRET is not set - using empty string. Tokens will be insecure.");
}
