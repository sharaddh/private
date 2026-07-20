import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { transactionSchema } from "../validators/workspace.validator";
import * as workspaceController from "../controllers/workspaceController";

const router = Router();

router.post("/transaction", authenticate, validate(transactionSchema, "body"), asyncHandler(workspaceController.transaction));

router.get("/todos", authenticate, asyncHandler(workspaceController.listTodos));
router.post("/todos", authenticate, asyncHandler(workspaceController.createTodo));
router.patch("/todos/:id", authenticate, asyncHandler(workspaceController.toggleTodo));
router.delete("/todos/:id", authenticate, asyncHandler(workspaceController.deleteTodo));

export default router;
