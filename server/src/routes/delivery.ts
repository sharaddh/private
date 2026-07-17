import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import * as deliveryController from "../controllers/deliveryController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(deliveryController.list));

router.get("/:id", authenticate, asyncHandler(deliveryController.getById));

export default router;
