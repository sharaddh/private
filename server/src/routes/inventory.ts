import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { createInventorySchema, updateInventorySchema, stockAdjustSchema } from "../validators/inventory.validator";
import * as inventoryController from "../controllers/inventoryController";

const router = Router();

router.get("/stats", authenticate, asyncHandler(inventoryController.getStats));

router.get("/", authenticate, cacheRoute(60), asyncHandler(inventoryController.list));

router.get("/:id", authenticate, asyncHandler(inventoryController.getById));

router.get("/qr/:code", authenticate, asyncHandler(inventoryController.getBySku));

router.get("/:id/qr-image", authenticate, asyncHandler(inventoryController.getQrImage));

router.post("/", authenticate, audit, validate(createInventorySchema, "body"), asyncHandler(inventoryController.create));

router.put("/:id/stock", authenticate, audit, validate(stockAdjustSchema, "body"), asyncHandler(inventoryController.adjustStock));

router.put("/:id", authenticate, audit, validate(updateInventorySchema, "body"), asyncHandler(inventoryController.update));

router.delete("/:id", authenticate, audit, asyncHandler(inventoryController.remove));

export default router;
