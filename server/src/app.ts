import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { CORS_ORIGINS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "./config";
import routes from "./routes";
import { audit } from "./middleware/audit";
import { errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { verifyWebhook, handleWebhookVerification } from "./middleware/verifyWebhook";
import { webhookHandler } from "./controllers/whatsapp.controller";
import { asyncHandler } from "./middleware/asyncHandler";

const app = express();

app.set("trust proxy", 1);

app.use(requestId);

app.use((_req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[SLOW] ${_req.method} ${_req.originalUrl} took ${duration}ms`);
    }
  });
  next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(compression({ level: 6, threshold: 1024 }));

app.get("/api/whatsapp/webhook", (req, res) => handleWebhookVerification(req, res));
app.post("/api/whatsapp/webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, _res, next) => {
  (req as any).rawBody = req.body;
  next();
}, verifyWebhook, asyncHandler(webhookHandler));

app.use(express.json({ limit: "25mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(audit);

app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api", routes);

app.get("/favicon.ico", (_req, res) => res.status(204).end());

function findDistPath(candidates: string[], label: string): string {
  console.log(`[DIST] Searching for ${label}...`);
  for (const p of candidates) {
    console.log(`[DIST]   Checking: ${p} -> ${fs.existsSync(p) ? "FOUND" : "missing"}`);
    if (fs.existsSync(p)) return p;
  }
  console.log(`[DIST] ${label} not found in any candidate path`);
  return "";
}

console.log(`[BOOT] __dirname=${__dirname}, cwd=${process.cwd()}, platform=${process.platform}`);

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
  console.log(`[SERVE] Client dist: ${distPath}`);
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));
} else {
  console.warn("[SERVE] Client dist NOT found - client app will not be served");
}

if (warehouseIndex && fs.existsSync(warehouseIndex)) {
  console.log(`[SERVE] Warehouse dist: ${warehouseDistPath}`);
  app.use("/warehouse", express.static(warehouseDistPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));
  app.get("/warehouse*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(warehouseIndex);
  });
} else {
  console.warn("[SERVE] Warehouse dist NOT found - warehouse app will not be served");
}

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ success: false, message: "API route not found" });
    return;
  }
  if (distIndex && fs.existsSync(distIndex)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(distIndex);
    return;
  }
  if (warehouseIndex && fs.existsSync(warehouseIndex)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(warehouseIndex);
    return;
  }
  res.status(200).json({ success: true, message: "KMJ ERP API" });
});

app.use(errorHandler);

export default app;

