import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as warehouseAggController from "../controllers/warehouseAggregate.controller";
import * as warehouseLensStockController from "../controllers/warehouseLensStock.controller";
import * as warehouseInventoryController from "../controllers/warehouseInventory.controller";

const router = Router();

// Warehouse aggregate (cross-branch + warehouse) read endpoints
router.get("/inventory/stats", authenticate, asyncHandler(warehouseAggController.getStats));
router.get("/inventory", authenticate, asyncHandler(warehouseAggController.listInventory));
router.get("/lens-stock", authenticate, asyncHandler(warehouseAggController.listLensStock));

// Warehouse lens stock CRUD
router.post("/lens-stock", authenticate, asyncHandler(warehouseLensStockController.create));
router.get("/lens-stock/list", authenticate, asyncHandler(warehouseLensStockController.list));
router.get("/lens-stock/:id", authenticate, asyncHandler(warehouseLensStockController.getById));
router.put("/lens-stock/:id", authenticate, asyncHandler(warehouseLensStockController.rename));
router.delete("/lens-stock/:id", authenticate, asyncHandler(warehouseLensStockController.remove));
router.put("/lens-stock/:id/quantity", authenticate, asyncHandler(warehouseLensStockController.updateQuantity));
router.put("/lens-stock/:id/quantities", authenticate, asyncHandler(warehouseLensStockController.bulkUpdate));

// Warehouse inventory CRUD
router.post("/inventory", authenticate, asyncHandler(warehouseInventoryController.create));
router.get("/inventory/list", authenticate, asyncHandler(warehouseInventoryController.list));
router.get("/inventory/:id", authenticate, asyncHandler(warehouseInventoryController.getById));
router.put("/inventory/:id", authenticate, asyncHandler(warehouseInventoryController.update));
router.delete("/inventory/:id", authenticate, asyncHandler(warehouseInventoryController.remove));
router.put("/inventory/:id/stock", authenticate, asyncHandler(warehouseInventoryController.adjustStock));

export default router;
