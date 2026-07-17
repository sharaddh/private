import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { createBillSchema, updateBillSchema } from "../validators/bill.validator";
import * as billController from "../controllers/billController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(billController.list));

router.post("/", authenticate, audit, validate(createBillSchema, "body"), asyncHandler(async (req, res, next) => {
  await billController.create(req, res);
  await invalidateCache("/api/bills");
  await invalidateCache("/api/dashboard");
}));

router.get("/:id", authenticate, asyncHandler(billController.getById));

router.put("/:id", authenticate, audit, validate(updateBillSchema, "body"), asyncHandler(async (req, res) => {
  await billController.update(req, res);
  await invalidateCache("/api/bills");
  await invalidateCache("/api/dashboard");
}));

router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  await billController.remove(req, res);
  await invalidateCache("/api/bills");
  await invalidateCache("/api/dashboard");
}));

export default router;
