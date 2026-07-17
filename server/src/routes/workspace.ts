import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { transactionSchema } from "../validators/workspace.validator";
import * as workspaceController from "../controllers/workspaceController";

const router = Router();

router.post("/transaction", authenticate, validate(transactionSchema, "body"), asyncHandler(workspaceController.transaction));

export default router;
