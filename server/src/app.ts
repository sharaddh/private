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
app.use(cors());
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
const distPath: string | null = possiblePaths.find((p) => fs.existsSync(p)) || null;

if (distPath) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ success: false, message: "API route not found" });
      return;
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("<!DOCTYPE html><html><head><title>KMJ Optical</title></head><body><div id='root'></div><script>window.location.href='/index.html'</script></body></html>");
    }
  });
} else {
  app.get("/", (req, res) => res.json({ success: true, message: "KMJ ERP API" }));
}

app.use(errorHandler);

export default app;
