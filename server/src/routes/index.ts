import { Router } from "express";
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

const router = Router();

router.use("/customers", customers);
router.use("/auth", auth);
router.use("/orders", orders);
router.use("/todos", todos);
router.use("/bills", bills);
router.use("/payments", payments);
router.use("/delivery", delivery);
router.use("/inventory", inventory);
router.use("/visits", visits);
router.use("/prescriptions", prescriptions);
router.use("/dashboard", dashboard);
router.use("/reports", reports);
router.use("/settings", settings);
router.use("/workspace", workspace);
router.use("/whatsapp", whatsapp);
router.use("/cache", cacheAdmin);

export default router;
