import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as warehouseAggController from "../controllers/warehouseAggregate.controller";

const router = Router();

router.get("/inventory/stats", authenticate, asyncHandler(warehouseAggController.getStats));
router.get("/inventory", authenticate, asyncHandler(warehouseAggController.listInventory));
router.get("/lens-stock", authenticate, asyncHandler(warehouseAggController.listLensStock));

export default router;
