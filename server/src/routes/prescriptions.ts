import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";
import { createPrescriptionSchema, updatePrescriptionSchema } from "../validators/prescription.validator";
import * as prescriptionController from "../controllers/prescriptionController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(prescriptionController.list));

router.post("/", authenticate, validate(createPrescriptionSchema, "body"), asyncHandler(prescriptionController.create));

router.get("/:id", authenticate, asyncHandler(prescriptionController.getById));

router.put("/:id", authenticate, validate(updatePrescriptionSchema, "body"), asyncHandler(prescriptionController.update));

router.delete("/:id", authenticate, asyncHandler(prescriptionController.remove));

export default router;
