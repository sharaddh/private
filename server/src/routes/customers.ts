import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import * as customerController from "../controllers/customerController";

const router = Router();

router.get("/", authenticate, cacheRoute(60), customerController.getAll);
router.post("/", authenticate, (req, res, next) => {
  invalidateCache("/api/customers");
  customerController.create(req, res, next);
});
router.get("/summary/:id", authenticate, cacheRoute(30), customerController.getSummary);
router.get("/:id", authenticate, customerController.getById);
router.put("/:id", authenticate, (req, res, next) => {
  invalidateCache("/api/customers");
  customerController.update(req, res, next);
});
router.delete("/:id", authenticate, (req, res, next) => {
  invalidateCache("/api/customers");
  customerController.remove(req, res, next);
});

export default router;
