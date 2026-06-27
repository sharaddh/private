import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { asyncHandler } from "../middleware/asyncHandler";
import * as customerController from "../controllers/customerController";

const router = Router();

router.get("/", authenticate, cacheRoute(60), asyncHandler(customerController.getAll));
router.post("/", authenticate, asyncHandler(async (req, res, next) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.create(req, res);
}));
router.get("/summary/:id", authenticate, cacheRoute(30), asyncHandler(customerController.getSummary));
router.get("/:id", authenticate, asyncHandler(customerController.getById));
router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.update(req, res);
}));
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.remove(req, res);
}));

export default router;
