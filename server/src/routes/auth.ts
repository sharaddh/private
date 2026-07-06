import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as authController from "../controllers/authController";

const router = Router();

router.post("/register", authenticate, asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/staff-login", asyncHandler(authController.staffLogin));
router.post("/warehouse-login", asyncHandler(authController.warehouseLogin));
router.post("/warehouse-register", authenticate, asyncHandler(authController.warehouseRegister));
router.post("/refresh", asyncHandler(authController.refresh));
router.get("/me", authenticate, asyncHandler(authController.me));
router.put("/me", authenticate, asyncHandler(authController.updateMe));
router.get("/users", authenticate, asyncHandler(authController.listUsers));
router.get("/warehouse-users", authenticate, asyncHandler(authController.listWarehouseUsers));
router.put("/users/:id", authenticate, asyncHandler(authController.updateUser));
router.delete("/users/:id", authenticate, asyncHandler(authController.deleteUser));

export default router;
