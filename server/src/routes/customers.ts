import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as customerController from "../controllers/customerController";

const router = Router();

router.get("/", authenticate, customerController.getAll);
router.post("/", authenticate, customerController.create);
router.get("/summary/:id", authenticate, customerController.getSummary);
router.get("/:id", authenticate, customerController.getById);
router.put("/:id", authenticate, customerController.update);
router.delete("/:id", authenticate, customerController.remove);

export default router;
