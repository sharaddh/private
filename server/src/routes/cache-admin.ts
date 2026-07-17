import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as cacheController from "../controllers/cacheController";

const router = Router();

router.get("/status", authenticate, asyncHandler(cacheController.status));
router.post("/flush", authenticate, requireRole("owner"), asyncHandler(cacheController.flush));

export default router;
