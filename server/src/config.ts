process.env.TZ = process.env.TZ || "Asia/Kolkata";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive()).default(4000),
  MONGO_URI: z.string().default(""),
  JWT_SECRET: z.string().default(""),
  JWT_ACCESS_EXPIRY: z.string().default("7d"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  REDIS_URL: z.string().default(""),
  WAREHOUSE_DB_NAME: z.string().default("kmj_warehouse"),
  NODE_ENV: z.string().default("development"),
  CORS_ORIGINS: z.string().default(""),
  RATE_LIMIT_WINDOW_MS: z
    .preprocess(emptyToUndefined, z.coerce.number().int().positive())
    .default(60000),
  RATE_LIMIT_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().positive()).default(1000),
  AUTH_RATE_LIMIT_MAX: z
    .preprocess(emptyToUndefined, z.coerce.number().int().positive())
    .default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_CLUSTER: z.string().default("false"),
  CLUSTER_WORKERS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive()).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`[CONFIG] Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export const PORT = env.PORT;
export const MONGO_URI = env.MONGO_URI;
export const JWT_SECRET = env.JWT_SECRET;
export const JWT_ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY;
export const JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY;
export const REDIS_URL = env.REDIS_URL;
export const WAREHOUSE_DB_NAME = env.WAREHOUSE_DB_NAME;
export const NODE_ENV = env.NODE_ENV;
export const LOG_LEVEL = env.LOG_LEVEL;
export const CORS_ORIGINS = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [
      "https://kmjoptical.onrender.com",
      "http://localhost:5173",
      "http://localhost:4000",
      "http://localhost:5174",
      "https://kmj-m9aq.onrender.com",
    ];

export const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
export const RATE_LIMIT_MAX = env.RATE_LIMIT_MAX;
export const AUTH_RATE_LIMIT_MAX = env.AUTH_RATE_LIMIT_MAX;

export const ENABLE_CLUSTER = env.ENABLE_CLUSTER === "true" || env.ENABLE_CLUSTER === "1";
export const CLUSTER_WORKERS = env.CLUSTER_WORKERS || 0;
export const isProduction = env.NODE_ENV === "production";

if (isProduction) {
  const missing = [
    { name: "JWT_SECRET", value: env.JWT_SECRET },
    { name: "MONGO_URI", value: env.MONGO_URI },
  ].filter((r) => !r.value);
  if (missing.length > 0) {
    console.error(
      `[CONFIG] Missing required environment variables in production: ${missing.map((m) => m.name).join(", ")}`
    );
    process.exit(1);
  }
}
