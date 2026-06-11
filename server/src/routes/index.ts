import { Router } from "express";
import customers from "./customers";
import auth from "./auth";
import orders from "./orders";
import bills from "./bills";
import payments from "./payments";

const router = Router();

router.use("/customers", customers);
router.use("/auth", auth);
router.use("/orders", orders);
router.use("/bills", bills);
router.use("/payments", payments);

export default router;
