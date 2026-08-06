import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as lensStockController from "../controllers/lensStock.controller";
import * as shopLensCartController from "../controllers/shopLensCart.controller";

const router = Router();

router.get("/cart", authenticate, asyncHandler(shopLensCartController.getItems));
router.get("/cart/count", authenticate, asyncHandler(shopLensCartController.getCount));
router.post("/cart", authenticate, asyncHandler(shopLensCartController.addItem));
router.put("/cart/:id", authenticate, asyncHandler(shopLensCartController.updateItem));
router.delete("/cart/:id", authenticate, asyncHandler(shopLensCartController.removeItem));
router.delete("/cart", authenticate, asyncHandler(shopLensCartController.clearCart));
router.post("/cart/withdraw", authenticate, asyncHandler(shopLensCartController.withdraw));
router.get("/withdrawals", authenticate, asyncHandler(shopLensCartController.getWithdrawals));
router.put("/withdrawals/:id", authenticate, asyncHandler(shopLensCartController.updateWithdrawal));
router.delete("/withdrawals/:id", authenticate, asyncHandler(shopLensCartController.deleteWithdrawal));

router.get("/", authenticate, asyncHandler(lensStockController.list));
router.get("/:id", authenticate, asyncHandler(lensStockController.getById));
router.post("/", authenticate, asyncHandler(lensStockController.create));
router.put("/:id", authenticate, asyncHandler(lensStockController.rename));
router.delete("/:id", authenticate, asyncHandler(lensStockController.remove));
router.put("/:id/quantity", authenticate, asyncHandler(lensStockController.updateQuantity));
router.put("/:id/quantities", authenticate, asyncHandler(lensStockController.bulkUpdate));

export default router;
