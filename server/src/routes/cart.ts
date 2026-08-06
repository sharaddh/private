import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as cartController from "../controllers/cart.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(cartController.getItems));
router.get("/count", authenticate, asyncHandler(cartController.getCount));
router.post("/", authenticate, asyncHandler(cartController.addItem));
router.put("/:id", authenticate, asyncHandler(cartController.updateItem));
router.delete("/:id", authenticate, asyncHandler(cartController.removeItem));
router.delete("/", authenticate, asyncHandler(cartController.clearCart));
router.post("/withdraw", authenticate, asyncHandler(cartController.withdraw));
router.get("/withdrawals", authenticate, asyncHandler(cartController.getMyWithdrawals));
router.get("/withdrawals/all", authenticate, asyncHandler(cartController.getAllWithdrawals));
router.put("/withdrawals/:id/pay", authenticate, asyncHandler(cartController.markWithdrawalPaid));
router.put("/withdrawals/:id", authenticate, asyncHandler(cartController.updateWithdrawal));
router.delete("/withdrawals/:id", authenticate, asyncHandler(cartController.deleteWithdrawal));
router.post("/withdrawals/:id/send-pdf", authenticate, asyncHandler(cartController.sendWithdrawalPdf));

export default router;
