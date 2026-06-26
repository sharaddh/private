import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
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
  ],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(audit);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
  })
);

app.use("/api", routes);

// Handle favicon to prevent 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Resolve client dist directory with case-insensitive fallback
function findDistPath(candidates: string[]): string {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
    // Try case-insensitive match on Windows
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
  console.log("Serving client from:", distPath);
  app.use(express.static(distPath));

  // SPA catch-all: only serve index.html for non-file, non-API requests
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ success: false, message: "API route not found" });
      return;
    }
    const filePath = path.join(distPath, "index.html");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(200).json({ success: true, message: "KMJ ERP API" });
    }
  });
} else {
  console.log("Client dist not found, checked:", possiblePaths.join(", "));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ success: false, message: "API route not found" });
    const fallbackPath = path.resolve(process.cwd(), "client/dist/index.html");
    if (fs.existsSync(fallbackPath)) {
      res.sendFile(fallbackPath);
    } else {
      res.status(200).json({ success: true, message: "KMJ ERP API" });
    }
  });
}
// This runs internally inside your server every 5 minutes (300,000 ms)
setInterval(() => {
  console.log("Running auto-task inside server...");
  try {
    // Put your automated logic here (e.g., db cleanup, data sync)
  } catch (error) {
    console.error("Error running auto-task:", error);
  }
}, 5 * 60 * 1000);

app.use(errorHandler);

export default app;
