import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as lensStockController from "../controllers/lensStock.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(lensStockController.list));
router.get("/:id", authenticate, asyncHandler(lensStockController.getById));
router.post("/", authenticate, asyncHandler(lensStockController.create));
router.put("/:id", authenticate, asyncHandler(lensStockController.rename));
router.delete("/:id", authenticate, asyncHandler(lensStockController.remove));
router.put("/:id/quantity", authenticate, asyncHandler(lensStockController.updateQuantity));
router.put("/:id/quantities", authenticate, asyncHandler(lensStockController.bulkUpdate));

export default router;
