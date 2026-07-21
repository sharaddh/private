import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { createPaymentSchema, updatePaymentSchema } from "../validators/payment.validator";
import * as paymentController from "../controllers/paymentController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(paymentController.list));

router.post("/", authenticate, audit, validate(createPaymentSchema, "body"), asyncHandler(async (req, res) => {
  await paymentController.create(req, res);
  invalidateCache("/api/payments");
  invalidateCache("/api/dashboard");
}));

router.put("/:id", authenticate, audit, validate(updatePaymentSchema, "body"), asyncHandler(async (req, res) => {
  await paymentController.update(req, res);
  invalidateCache("/api/payments");
  invalidateCache("/api/dashboard");
}));

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  await paymentController.remove(req, res);
  invalidateCache("/api/payments");
  invalidateCache("/api/dashboard");
}));

export default router;
