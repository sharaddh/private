import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { audit } from "./middleware/audit";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    "https://kmjoptical.onrender.com",
    "http://localhost:5173",
    "http://localhost:4000",
    "http://localhost:5174",
  ],
  credentials: true,
}));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: "10mb" }));
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

// Handle favicon to prevent 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Resolve client dist directory with case-insensitive fallback
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

const clientDist = path.resolve(__dirname, "../../client/dist");
const possiblePaths = [clientDist, path.resolve(__dirname, "../client/dist"), path.resolve(process.cwd(), "client/dist")];
const distPath = findDistPath(possiblePaths);

if (distPath && fs.existsSync(path.join(distPath, "index.html"))) {
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ success: false, message: "API route not found" });
      return;
    }
    const filePath = path.join(distPath, "index.html");
    if (fs.existsSync(filePath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(filePath);
    } else {
      res.status(200).json({ success: true, message: "KMJ ERP API" });
    }
  });
} else {
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ success: false, message: "API route not found" });
    const fallbackPath = path.resolve(process.cwd(), "client/dist/index.html");
    if (fs.existsSync(fallbackPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(fallbackPath);
    } else {
      res.status(200).json({ success: true, message: "KMJ ERP API" });
    }
  });
}

app.use(errorHandler);

export default app;
