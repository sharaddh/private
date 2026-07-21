import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { createPrescriptionSchema, updatePrescriptionSchema } from "../validators/prescription.validator";
import * as prescriptionController from "../controllers/prescriptionController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(prescriptionController.list));

router.post("/", authenticate, validate(createPrescriptionSchema, "body"), asyncHandler(async (req, res) => {
  await prescriptionController.create(req, res);
  invalidateCache("/api/prescriptions");
}));

router.get("/:id", authenticate, asyncHandler(prescriptionController.getById));

router.put("/:id", authenticate, validate(updatePrescriptionSchema, "body"), asyncHandler(async (req, res) => {
  await prescriptionController.update(req, res);
  invalidateCache("/api/prescriptions");
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await prescriptionController.remove(req, res);
  invalidateCache("/api/prescriptions");
}));

export default router;
