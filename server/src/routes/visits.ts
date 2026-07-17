import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import { createVisitSchema, updateVisitSchema } from "../validators/visit.validator";
import * as visitController from "../controllers/visitController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(visitController.list));

router.post("/", authenticate, validate(createVisitSchema, "body"), asyncHandler(visitController.create));

router.get("/:id", authenticate, asyncHandler(visitController.getById));

router.put("/:id", authenticate, validate(updateVisitSchema, "body"), asyncHandler(visitController.update));

router.delete("/:id", authenticate, asyncHandler(visitController.remove));

export default router;
