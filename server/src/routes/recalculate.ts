import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as recalculateController from "../controllers/recalculateController";

const router = Router();

router.post("/customer-totals", authenticate, requireRole("owner"), asyncHandler(recalculateController.recalculate));

export default router;
