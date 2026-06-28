import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as authController from "../controllers/authController";

const router = Router();

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/staff-login", asyncHandler(authController.staffLogin));
router.post("/refresh", asyncHandler(authController.refresh));
router.get("/me", authenticate, asyncHandler(authController.me));
router.put("/me", authenticate, asyncHandler(authController.updateMe));
router.get("/users", authenticate, asyncHandler(authController.listUsers));
router.delete("/users/:id", authenticate, asyncHandler(authController.deleteUser));

export default router;
