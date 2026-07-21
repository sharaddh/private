import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { invalidateCache } from "../middleware/cache";
import { createTodoSchema, updateTodoSchema } from "../validators/todo.validator";
import * as todoController from "../controllers/todoController";

const router = Router();

router.get("/", authenticate, asyncHandler(todoController.getAll));
router.post("/", authenticate, validate(createTodoSchema, "body"), asyncHandler(async (req, res) => {
  await todoController.create(req, res);
  invalidateCache("/api/todos");
}));
router.patch("/:id", authenticate, validate(updateTodoSchema, "body"), asyncHandler(async (req, res) => {
  await todoController.update(req, res);
  invalidateCache("/api/todos");
}));
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await todoController.remove(req, res);
  invalidateCache("/api/todos");
}));

export default router;
