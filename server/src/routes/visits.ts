import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { createVisitSchema, updateVisitSchema } from "../validators/visit.validator";
import * as visitController from "../controllers/visitController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(visitController.list));

router.post("/", authenticate, validate(createVisitSchema, "body"), asyncHandler(async (req, res) => {
  await visitController.create(req, res);
  invalidateCache("/api/visits");
  invalidateCache("/api/dashboard");
}));

router.get("/:id", authenticate, asyncHandler(visitController.getById));

router.put("/:id", authenticate, validate(updateVisitSchema, "body"), asyncHandler(async (req, res) => {
  await visitController.update(req, res);
  invalidateCache("/api/visits");
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await visitController.remove(req, res);
  invalidateCache("/api/visits");
  invalidateCache("/api/dashboard");
}));

export default router;
