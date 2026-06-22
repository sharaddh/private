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

const clientDist = path.resolve(__dirname, "../../client/dist");
const possiblePaths = [clientDist, path.resolve(__dirname, "../client/dist"), path.resolve(process.cwd(), "client/dist")];
let distPath = "";
for (const p of possiblePaths) {
  if (fs.existsSync(p)) { distPath = p; break; }
}

if (distPath) {
  console.log("Serving client from:", distPath);
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ success: false, message: "API route not found" });
      return;
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.log("Client dist not found, checked:", possiblePaths.join(", "));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ success: false, message: "API route not found" });
    res.status(200).sendFile(path.join(__dirname, "../../client/dist/index.html"), (err) => {
      if (err) res.json({ success: true, message: "KMJ ERP API" });
    });
  });
}

app.use(errorHandler);

export default app;
