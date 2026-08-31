import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import {
  CORS_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
  NODE_ENV,
} from "./config";
import routes from "./routes";
import { audit } from "./middleware/audit";
import { errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { createRateLimitStore } from "./middleware/rateLimitStore";
import { verifyWebhook, handleWebhookVerification } from "./middleware/verifyWebhook";
import { webhookHandler } from "./controllers/whatsapp.controller";
import { asyncHandler } from "./middleware/asyncHandler";
import { verifyToken } from "./utils/jwt";
import { pinoLogger, logger } from "./utils/logger";

const app = express();

app.set("trust proxy", 1);
app.set("x-powered-by", false);

app.use(requestId);

if (NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger: pinoLogger,
      genReqId: (req) => req.headers["x-request-id"] as string,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} -> ${res.statusCode}: ${err.message}`,
      autoLogging: {
        ignore: (req) => req.url?.startsWith("/api/health") || req.url?.startsWith("/api/ready"),
      },
    })
  );
}

app.use((_req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn("Slow request", {
        method: _req.method,
        url: _req.originalUrl,
        durationMs: duration,
      });
    }
  });
  next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);
app.use(compression({ level: 6, threshold: 1024 }));

app.get("/api/whatsapp/webhook", (req, res) => handleWebhookVerification(req, res));
app.post(
  "/api/whatsapp/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, _res, next) => {
    (req as any).rawBody = req.body;
    next();
  },
  verifyWebhook,
  asyncHandler(webhookHandler)
);

app.use(express.json({ limit: "25mb" }));
app.use(audit);

const keyGenerator = (req: express.Request): string => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken<{ sub?: string }>(header.slice(7));
      if (payload?.sub) return `user:${payload.sub}`;
    } catch {
      // invalid/expired token - fall through to IP-based key
    }
  }
  return req.ip || "unknown";
};

// Global limit: per authenticated user, otherwise per IP. Redis-backed so the
// limit is consistent across all instances behind a load balancer.
app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: createRateLimitStore("rl:global"),
  })
);

// Stricter limit for auth endpoints to prevent brute-force login attempts.
app.use(
  "/api/auth",
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || "unknown",
    skipSuccessfulRequests: false,
    store: createRateLimitStore("rl:auth"),
  })
);

app.use("/api", routes);

app.get("/favicon.ico", (_req, res) => res.status(204).end());

function findDistPath(candidates: string[], label: string): string {
  logger.info(`[DIST] Searching for ${label}...`);
  for (const p of candidates) {
    logger.info(`[DIST]   Checking: ${p} -> ${fs.existsSync(p) ? "FOUND" : "missing"}`);
    if (fs.existsSync(p)) return p;
  }
  logger.warn(`[DIST] ${label} not found in any candidate path`);
  return "";
}

function isAssetRequest(reqPath: string): boolean {
  return path.extname(reqPath) !== "";
}

function sendSpaIndex(res: express.Response, indexPath: string): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(indexPath);
}

logger.info(`[BOOT] __dirname=${__dirname}, cwd=${process.cwd()}, platform=${process.platform}`);

const clientDistCandidates = [
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../client/dist"),
  path.resolve(process.cwd(), "client/dist"),
  path.resolve(process.cwd(), "../client/dist"),
  path.resolve(process.cwd(), "../../client/dist"),
];
const distPath = findDistPath(clientDistCandidates, "client/dist");
const distIndex = distPath ? path.join(distPath, "index.html") : "";

const warehouseDistCandidates = [
  path.resolve(__dirname, "../../warehouse/dist"),
  path.resolve(__dirname, "../warehouse/dist"),
  path.resolve(process.cwd(), "warehouse/dist"),
  path.resolve(process.cwd(), "../warehouse/dist"),
  path.resolve(process.cwd(), "../../warehouse/dist"),
  path.join(__dirname, "..", "..", "warehouse", "dist"),
];
const warehouseDistPath = findDistPath(warehouseDistCandidates, "warehouse/dist");
const warehouseIndex = warehouseDistPath ? path.join(warehouseDistPath, "index.html") : "";

if (distIndex && fs.existsSync(distIndex)) {
  logger.info(`[SERVE] Client dist: ${distPath}`);
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );
} else {
  logger.warn("[SERVE] Client dist NOT found - client app will not be served");
}

if (warehouseIndex && fs.existsSync(warehouseIndex)) {
  logger.info(`[SERVE] Warehouse dist: ${warehouseDistPath}`);
  app.use(
    "/warehouse",
    express.static(warehouseDistPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );
  app.get(["/warehouse", "/warehouse/"], (_req, res) => {
    sendSpaIndex(res, warehouseIndex);
  });
  app.get("/warehouse/*", (req, res) => {
    if (isAssetRequest(req.path)) {
      res.status(404).end();
      return;
    }
    sendSpaIndex(res, warehouseIndex);
  });
} else {
  logger.warn("[SERVE] Warehouse dist NOT found - warehouse app will not be served");
}

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ success: false, message: "API route not found" });
    return;
  }
  if (distIndex && fs.existsSync(distIndex)) {
    if (isAssetRequest(req.path)) {
      res.status(404).end();
      return;
    }
    sendSpaIndex(res, distIndex);
    return;
  }
  if (warehouseIndex && fs.existsSync(warehouseIndex)) {
    if (isAssetRequest(req.path)) {
      res.status(404).end();
      return;
    }
    sendSpaIndex(res, warehouseIndex);
    return;
  }
  res.status(200).json({ success: true, message: "KMJ ERP API" });
});

app.use(errorHandler);

export default app;
