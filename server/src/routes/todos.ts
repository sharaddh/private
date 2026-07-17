import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { createTodoSchema, updateTodoSchema } from "../validators/todo.validator";
import * as todoController from "../controllers/todoController";

const router = Router();

router.get("/", authenticate, asyncHandler(todoController.getAll));
router.post("/", authenticate, validate(createTodoSchema, "body"), asyncHandler(todoController.create));
router.patch("/:id", authenticate, validate(updateTodoSchema, "body"), asyncHandler(todoController.update));
router.delete("/:id", authenticate, asyncHandler(todoController.remove));

export default router;
