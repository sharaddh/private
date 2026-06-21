import { Router } from "express";
import { Todo } from "../models/todo";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  const list = await Todo.find().sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

router.post("/", authenticate, async (req, res) => {
  const { task, notes } = req.body;
  if (!task) return res.status(400).json({ success: false, message: "Task is required" });
  const todo = await Todo.create({ task, notes });
  res.json({ success: true, data: todo });
});

router.patch("/:id", authenticate, async (req, res) => {
  const t = await Todo.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!t) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: t });
});

router.delete("/:id", authenticate, async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
