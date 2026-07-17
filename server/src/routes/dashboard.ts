import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import * as dashboardController from "../controllers/dashboardController";

const router = Router();

router.get("/stats", authenticate, cacheRoute(30), asyncHandler(dashboardController.getStats));

export default router;
