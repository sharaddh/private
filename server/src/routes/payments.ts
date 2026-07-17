import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import { createPaymentSchema, updatePaymentSchema } from "../validators/payment.validator";
import * as paymentController from "../controllers/paymentController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(paymentController.list));

router.post("/", authenticate, audit, validate(createPaymentSchema, "body"), asyncHandler(paymentController.create));

router.put("/:id", authenticate, audit, validate(updatePaymentSchema, "body"), asyncHandler(paymentController.update));

router.delete("/:id", authenticate, audit, asyncHandler(paymentController.remove));

export default router;
