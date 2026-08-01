import { Router } from "express";
import { authenticate, optionalAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { registerSchema, loginSchema, refreshSchema, updateMeSchema, updateUserSchema } from "../validators/auth.validator";
import { createBranchSchema } from "../validators/branch.validator";
import * as authController from "../controllers/authController";

const router = Router();

router.post("/register", authenticate, validate(registerSchema, "body"), asyncHandler(authController.register));
router.post("/register-owner", optionalAuth, validate(registerSchema, "body"), asyncHandler(authController.registerOwner));
router.post("/register-branch-owner", validate(createBranchSchema, "body"), asyncHandler(authController.registerBranchOwner));
router.post("/login", validate(loginSchema, "body"), asyncHandler(authController.login));
router.post("/staff-login", validate(loginSchema, "body"), asyncHandler(authController.staffLogin));
router.post("/warehouse-login", validate(loginSchema, "body"), asyncHandler(authController.warehouseLogin));
router.post("/refresh", validate(refreshSchema, "body"), asyncHandler(authController.refresh));
router.get("/me", authenticate, asyncHandler(authController.me));
router.put("/me", authenticate, validate(updateMeSchema, "body"), asyncHandler(authController.updateMe));
router.get("/users", authenticate, asyncHandler(authController.listUsers));
router.get("/warehouse-users", authenticate, asyncHandler(authController.listWarehouseUsers));
router.put("/users/:id", authenticate, validate(updateUserSchema, "body"), asyncHandler(authController.updateUser));
router.delete("/users/:id", authenticate, asyncHandler(authController.deleteUser));

export default router;
