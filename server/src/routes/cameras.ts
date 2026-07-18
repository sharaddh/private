import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as cameraController from "../controllers/cameraController";

const router = Router();

router.get("/", authenticate, asyncHandler(cameraController.list));
router.get("/:id", authenticate, asyncHandler(cameraController.get));
router.get("/:id/status", authenticate, asyncHandler(cameraController.status));
router.post("/", authenticate, asyncHandler(cameraController.create));
router.patch("/:id", authenticate, asyncHandler(cameraController.update));
router.delete("/:id", authenticate, asyncHandler(cameraController.remove));

export default router;
