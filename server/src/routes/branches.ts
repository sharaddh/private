import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { createBranchSchema, updateBranchSchema } from "../validators/branch.validator";
import * as branchController from "../controllers/branchController";

const router = Router();

router.get("/active", asyncHandler(branchController.listActive));
router.get("/", authenticate, asyncHandler(branchController.listAll));
router.get("/:id", authenticate, asyncHandler(branchController.getById));
router.post("/", authenticate, validate(createBranchSchema, "body"), asyncHandler(branchController.create));
router.put("/:id", authenticate, validate(updateBranchSchema, "body"), asyncHandler(branchController.update));
router.delete("/:id", authenticate, asyncHandler(branchController.remove));

export default router;
