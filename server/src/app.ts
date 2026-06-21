import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { audit } from "./middleware/audit";

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
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return;
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.json({ success: true, message: "KMJ ERP API" }));
}

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
