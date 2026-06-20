import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { audit } from "./middleware/audit";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(audit);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200
  })
);

app.use("/api", routes);

app.get("/", (req, res) => res.json({ success: true, message: "KMJ ERP API" }));

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
