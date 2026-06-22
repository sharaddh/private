import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as todoController from "../controllers/todoController";

const router = Router();

router.get("/", authenticate, todoController.getAll);
router.post("/", authenticate, todoController.create);
router.patch("/:id", authenticate, todoController.update);
router.delete("/:id", authenticate, todoController.remove);

export default router;
