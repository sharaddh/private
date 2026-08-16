import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import * as productController from "../controllers/inventoryProduct.controller";
import * as stockController from "../controllers/inventoryStock.controller";
import * as countController from "../controllers/inventoryCount.controller";
import {
  createBrandSchema,
  updateBrandSchema,
  createProductSchema,
  updateProductSchema,
} from "../validators/inventoryProduct.validator";
import { createVariantSchema, updateVariantSchema } from "../validators/inventoryVariant.validator";
import {
  addStockSchema,
  createVariantWithStockSchema,
  withdrawStockSchema,
  stockAdjustSchema,
} from "../validators/inventoryStock.validator";
import { createRackSchema, updateRackSchema } from "../validators/rack.validator";
import {
  createCountSessionSchema,
  updateCountEntriesSchema,
  completeCountSessionSchema,
} from "../validators/inventoryCount.validator";

const router = Router();

function invalidateInventoryCache() {
  void invalidateCache("/api/inventory*");
}

// Dashboard
router.get("/dashboard", authenticate, cacheRoute(30), asyncHandler(productController.dashboard));

// Brands
router.get("/brands", authenticate, cacheRoute(30), asyncHandler(productController.listBrands));
router.post(
  "/brands",
  authenticate,
  audit,
  validate(createBrandSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.createBrand)
);
router.get(
  "/brands/:id/summary",
  authenticate,
  cacheRoute(30),
  asyncHandler(productController.getBrandSummary)
);
router.patch(
  "/brands/:id",
  authenticate,
  audit,
  validate(updateBrandSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.updateBrand)
);

// Products
router.get("/products", authenticate, cacheRoute(30), asyncHandler(productController.listProducts));
router.post(
  "/products",
  authenticate,
  audit,
  validate(createProductSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.createProduct)
);
router.get(
  "/products/:id",
  authenticate,
  cacheRoute(30),
  asyncHandler(productController.getProduct)
);
router.patch(
  "/products/:id",
  authenticate,
  audit,
  validate(updateProductSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.updateProduct)
);
router.delete(
  "/products/:id",
  authenticate,
  audit,
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.archiveProduct)
);

// Variants
router.get(
  "/variants/search",
  authenticate,
  cacheRoute(30),
  asyncHandler(productController.searchVariants)
);
router.get("/variants/by-sku/:sku", authenticate, asyncHandler(productController.getVariantBySku));
router.get("/variants", authenticate, cacheRoute(30), asyncHandler(productController.listVariants));
router.post(
  "/variants",
  authenticate,
  audit,
  validate(createVariantSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.createVariant)
);
router.post(
  "/variants/with-stock",
  authenticate,
  audit,
  validate(createVariantWithStockSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(stockController.createVariantWithStock)
);
router.get(
  "/variants/:id",
  authenticate,
  cacheRoute(30),
  asyncHandler(productController.getVariant)
);
router.patch(
  "/variants/:id",
  authenticate,
  audit,
  validate(updateVariantSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.updateVariant)
);
router.delete(
  "/variants/:id",
  authenticate,
  audit,
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.archiveVariant)
);

// Stock operations
router.post(
  "/stock/add",
  authenticate,
  audit,
  validate(addStockSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(stockController.addStock)
);
router.put(
  "/stock/:id/adjust",
  authenticate,
  audit,
  validate(stockAdjustSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(stockController.adjustStock)
);

// Withdrawals
router.post(
  "/withdraw",
  authenticate,
  audit,
  validate(withdrawStockSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(stockController.withdrawStock)
);
router.get(
  "/withdrawals",
  authenticate,
  cacheRoute(30),
  asyncHandler(stockController.listWithdrawals)
);
router.get("/withdrawals/:id", authenticate, asyncHandler(stockController.getWithdrawal));
router.post(
  "/withdrawals/:id/reverse",
  authenticate,
  audit,
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(stockController.reverseWithdrawal)
);

// Racks
router.get("/racks", authenticate, cacheRoute(30), asyncHandler(productController.listRacks));
router.post(
  "/racks",
  authenticate,
  audit,
  validate(createRackSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.createRack)
);
router.get(
  "/racks/:id/items",
  authenticate,
  cacheRoute(30),
  asyncHandler(productController.getRackItems)
);
router.patch(
  "/racks/:id",
  authenticate,
  audit,
  validate(updateRackSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(productController.updateRack)
);

// Movements
router.get("/movements", authenticate, cacheRoute(30), asyncHandler(stockController.listMovements));

// Count sessions
router.post(
  "/count-sessions",
  authenticate,
  audit,
  validate(createCountSessionSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(countController.createCountSession)
);
router.get(
  "/count-sessions",
  authenticate,
  cacheRoute(30),
  asyncHandler(countController.listCountSessions)
);
router.get("/count-sessions/:id", authenticate, asyncHandler(countController.getCountSession));
router.post(
  "/count-sessions/:id/entries",
  authenticate,
  audit,
  validate(updateCountEntriesSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(countController.updateCountEntries)
);
router.post(
  "/count-sessions/:id/complete",
  authenticate,
  audit,
  validate(completeCountSessionSchema, "body"),
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(countController.completeCountSession)
);
router.post(
  "/count-sessions/:id/cancel",
  authenticate,
  audit,
  (req, res, next) => {
    void invalidateInventoryCache();
    next();
  },
  asyncHandler(countController.cancelCountSession)
);

export default router;
