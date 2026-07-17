import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { updateSettingsSchema } from "../validators/settings.validator";
import * as settingsController from "../controllers/settingsController";

const router = Router();

router.get("/", authenticate, asyncHandler(settingsController.get));
router.put("/", authenticate, validate(updateSettingsSchema, "body"), asyncHandler(settingsController.update));

export default router;
