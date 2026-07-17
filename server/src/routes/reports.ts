import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import * as reportController from "../controllers/reportController";

const router = Router();

router.get("/revenue", authenticate, cacheRoute(60), asyncHandler(reportController.revenue));
router.get("/monthly", authenticate, cacheRoute(120), asyncHandler(reportController.monthly));
router.get("/customers", authenticate, cacheRoute(120), asyncHandler(reportController.customer));
router.get("/inventory", authenticate, cacheRoute(60), asyncHandler(reportController.inventory));
router.get("/deliveries", authenticate, cacheRoute(30), asyncHandler(reportController.delivery));

export default router;
