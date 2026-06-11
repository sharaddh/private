import { Router } from "express";
import customers from "./customers";

const router = Router();

router.use("/customers", customers);

export default router;
