import { Router } from "express";
import { Delivery } from "../models/delivery";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const { status } = req.query;
  const filter: any = {};
  if (status) filter.status = status;
  const list = await Delivery.find(filter)
    .populate("customerId", "name mobile")
    .populate("orderId", "frame lens status")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, data: list });
});

router.get("/:id", authenticate, async (req, res) => {
  const d = await Delivery.findById(req.params.id)
    .populate("customerId", "name mobile")
    .populate("orderId", "frame lens status");
  if (!d) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: d });
});

export default router;
