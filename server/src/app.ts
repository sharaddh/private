import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { CORS_ORIGINS } from "./config";
import routes from "./routes";
import { audit } from "./middleware/audit";
import { errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { verifyWebhook, handleWebhookVerification } from "./middleware/verifyWebhook";
import { webhookHandler } from "./controllers/whatsapp.controller";
import { asyncHandler } from "./middleware/asyncHandler";

const app = express();

app.use(requestId);
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
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api", routes);

app.get("/favicon.ico", (_req, res) => res.status(204).end());

function findDistPath(candidates: string[]): string {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
    if (process.platform === "win32") {
      const dir = path.dirname(p);
      const base = path.basename(p);
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir);
        const match = entries.find((e) => e.toLowerCase() === base.toLowerCase());
        if (match) return path.join(dir, match);
      }
    }
  }
  return "";
}

function findIndexHtml(): string {
  const fromDirname = path.resolve(__dirname, "../../client/dist/index.html");
  const fromDirname2 = path.resolve(__dirname, "../client/dist/index.html");
  const fromCwd = path.resolve(process.cwd(), "client/dist/index.html");
  const fromCwd2 = path.resolve(process.cwd(), "../client/dist/index.html");
  const candidates = [fromDirname, fromDirname2, fromCwd, fromCwd2];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "";
}

const clientDist = path.resolve(__dirname, "../../client/dist");
const possiblePaths = [
  clientDist,
  path.resolve(__dirname, "../client/dist"),
  path.resolve(process.cwd(), "client/dist"),
  path.resolve(process.cwd(), "../client/dist"),
];
const distPath = findDistPath(possiblePaths);
const distIndex = distPath ? path.join(distPath, "index.html") : "";

const warehouseDist = path.resolve(__dirname, "../../warehouse/dist");
const warehousePossiblePaths = [
  warehouseDist,
  path.resolve(__dirname, "../warehouse/dist"),
  path.resolve(process.cwd(), "warehouse/dist"),
  path.resolve(process.cwd(), "../warehouse/dist"),
];
const warehouseDistPath = findDistPath(warehousePossiblePaths);
const warehouseIndex = warehouseDistPath ? path.join(warehouseDistPath, "index.html") : "";

if (distIndex && fs.existsSync(distIndex)) {
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));
}

if (warehouseIndex && fs.existsSync(warehouseIndex)) {
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
}

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ success: false, message: "API route not found" });
    return;
  }
  const indexHtml = findIndexHtml();
  if (indexHtml) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(indexHtml);
    return;
  }
  res.status(200).json({ success: true, message: "KMJ ERP API" });
});

app.use(errorHandler);

export default app;
