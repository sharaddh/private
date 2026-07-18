import { Router } from "express";
import { branchScope } from "../middleware/branch";
import customers from "./customers";
import auth from "./auth";
import orders from "./orders";
import bills from "./bills";
import payments from "./payments";
import delivery from "./delivery";
import inventory from "./inventory";
import visits from "./visits";
import prescriptions from "./prescriptions";
import dashboard from "./dashboard";
import reports from "./reports";
import settings from "./settings";
import workspace from "./workspace";
import whatsapp from "./whatsapp";
import todos from "./todos";
import cacheAdmin from "./cache-admin";
import branches from "./branches";
import cameras from "./cameras";
import recalculate from "./recalculate";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

router.use("/branches", branches);
router.use("/auth", auth);
router.use("/customers", branchScope, customers);
router.use("/orders", branchScope, orders);
router.use("/todos", branchScope, todos);
router.use("/bills", branchScope, bills);
router.use("/payments", branchScope, payments);
router.use("/delivery", branchScope, delivery);
router.use("/inventory", branchScope, inventory);
router.use("/visits", branchScope, visits);
router.use("/prescriptions", branchScope, prescriptions);
router.use("/dashboard", branchScope, dashboard);
router.use("/reports", branchScope, reports);
router.use("/settings", branchScope, settings);
router.use("/workspace", branchScope, workspace);
router.use("/whatsapp", branchScope, whatsapp);
router.use("/cache", cacheAdmin);
router.use("/cameras", cameras);
router.use("/recalculate", recalculate);

export default router;
