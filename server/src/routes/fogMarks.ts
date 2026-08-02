import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as fogMarkController from "../controllers/fogMark.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(fogMarkController.list));
router.get("/:id", authenticate, asyncHandler(fogMarkController.getById));
router.post("/", authenticate, asyncHandler(fogMarkController.create));
router.put("/:id", authenticate, asyncHandler(fogMarkController.update));
router.delete("/:id", authenticate, asyncHandler(fogMarkController.remove));

export default router;
