"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = exports.CLUSTER_WORKERS = exports.ENABLE_CLUSTER = exports.WAREHOUSE_APP_URL = exports.CLIENT_APP_URL = exports.AUTH_RATE_LIMIT_MAX = exports.RATE_LIMIT_MAX = exports.RATE_LIMIT_WINDOW_MS = exports.CORS_ORIGINS = exports.LOG_LEVEL = exports.NODE_ENV = exports.WAREHOUSE_DB_NAME = exports.REDIS_URL = exports.JWT_REFRESH_EXPIRY = exports.JWT_ACCESS_EXPIRY = exports.JWT_SECRET = exports.DATABASE_URL = exports.MONGO_URI = exports.PORT = void 0;
process.env.TZ = process.env.TZ || "Asia/Kolkata";
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const emptyToUndefined = (v) => (v === "" ? undefined : v);
const envSchema = zod_1.z.object({
    PORT: zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().int().positive()).default(4000),
    MONGO_URI: zod_1.z.string().optional().default(""),
    DATABASE_URL: zod_1.z.string().default(""),
    JWT_SECRET: zod_1.z.string().default(""),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default("7d"),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default("7d"),
    REDIS_URL: zod_1.z.string().default(""),
    WAREHOUSE_DB_NAME: zod_1.z.string().default("kmj_warehouse"),
    NODE_ENV: zod_1.z.string().default("development"),
    CORS_ORIGINS: zod_1.z.string().default(""),
    CLIENT_APP_URL: zod_1.z.string().default(""),
    WAREHOUSE_APP_URL: zod_1.z.string().default(""),
    RATE_LIMIT_WINDOW_MS: zod_1.z
        .preprocess(emptyToUndefined, zod_1.z.coerce.number().int().positive())
        .default(60000),
    RATE_LIMIT_MAX: zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().int().positive()).default(500),
    AUTH_RATE_LIMIT_MAX: zod_1.z
        .preprocess(emptyToUndefined, zod_1.z.coerce.number().int().positive())
        .default(20),
    LOG_LEVEL: zod_1.z.enum(["debug", "info", "warn", "error"]).default("info"),
    ENABLE_CLUSTER: zod_1.z.string().default("false"),
    CLUSTER_WORKERS: zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().int().min(0)).default(0),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`[CONFIG] Invalid environment configuration:\n${issues}`);
    process.exit(1);
}
const env = parsed.data;
exports.PORT = env.PORT;
exports.MONGO_URI = env.MONGO_URI;
exports.DATABASE_URL = env.DATABASE_URL;
exports.JWT_SECRET = env.JWT_SECRET;
exports.JWT_ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY;
exports.JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY;
exports.REDIS_URL = env.REDIS_URL;
exports.WAREHOUSE_DB_NAME = env.WAREHOUSE_DB_NAME;
exports.NODE_ENV = env.NODE_ENV;
exports.LOG_LEVEL = env.LOG_LEVEL;
exports.CORS_ORIGINS = env.CORS_ORIGINS
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
exports.RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
exports.RATE_LIMIT_MAX = env.RATE_LIMIT_MAX;
exports.AUTH_RATE_LIMIT_MAX = env.AUTH_RATE_LIMIT_MAX;
/**
 * Public URLs of the separately deployed frontends.
 * Used as a fallback when the API service is built without the web app
 * bundles, so `https://<api-host>/` still lands the user on a working app.
 * Set to "none"/"off" to disable the fallback.
 */
const normalizeAppUrl = (raw, fallback) => {
    const value = (raw || fallback).trim();
    if (!value || /^(none|off|disabled|false)$/i.test(value))
        return "";
    return value.replace(/\/+$/, "");
};
exports.CLIENT_APP_URL = normalizeAppUrl(env.CLIENT_APP_URL, "https://kmjoptical.onrender.com");
exports.WAREHOUSE_APP_URL = normalizeAppUrl(env.WAREHOUSE_APP_URL, "https://kmj-m9aq.onrender.com");
exports.ENABLE_CLUSTER = env.ENABLE_CLUSTER === "true" || env.ENABLE_CLUSTER === "1";
exports.CLUSTER_WORKERS = env.CLUSTER_WORKERS || 0;
exports.isProduction = env.NODE_ENV === "production";
if (exports.isProduction) {
    const missing = [
        { name: "JWT_SECRET", value: env.JWT_SECRET },
        { name: "DATABASE_URL", value: env.DATABASE_URL },
    ].filter((r) => !r.value);
    if (missing.length > 0) {
        console.error(`[CONFIG] Missing required environment variables in production: ${missing.map((m) => m.name).join(", ")}`);
        process.exit(1);
    }
}
//# sourceMappingURL=config.js.map