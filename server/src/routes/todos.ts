import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as todoController from "../controllers/todoController";

const router = Router();

router.get("/", authenticate, asyncHandler(todoController.getAll));
router.post("/", authenticate, asyncHandler(todoController.create));
router.patch("/:id", authenticate, asyncHandler(todoController.update));
router.delete("/:id", authenticate, asyncHandler(todoController.remove));

export default router;
