import { Router } from "express";
import customers from "./customers";
import auth from "./auth";
import orders from "./orders";
import bills from "./bills";
import payments from "./payments";
import delivery from "./delivery";
import inventory from "./inventory";

const router = Router();

router.use("/customers", customers);
router.use("/auth", auth);
router.use("/orders", orders);
router.use("/bills", bills);
router.use("/payments", payments);
router.use("/delivery", delivery);
router.use("/inventory", inventory);

export default router;
