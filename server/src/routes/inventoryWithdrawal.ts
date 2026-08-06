import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { invalidateCache } from "../middleware/cache";
import {
  createWithdrawalSchema,
  listWithdrawalsQuerySchema,
} from "../validators/inventoryWithdrawal.validator";
import * as withdrawalController from "../controllers/inventoryWithdrawal.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  validate(listWithdrawalsQuerySchema, "query"),
  asyncHandler(withdrawalController.list)
);

router.get("/:id", authenticate, asyncHandler(withdrawalController.getById));

router.post(
  "/",
  authenticate,
  audit,
  validate(createWithdrawalSchema, "body"),
  (req, _res, next) => {
    void invalidateCache("/api/inventory*");
    void invalidateCache("*:/api/dashboard*");
    next();
  },
  asyncHandler(withdrawalController.create)
);

export default router;
