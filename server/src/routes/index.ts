import { Router } from "express";
import customers from "./customers";
import auth from "./auth";

const router = Router();

router.use("/customers", customers);
router.use("/auth", auth);

export default router;
