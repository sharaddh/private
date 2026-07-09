import { Request, Response } from "express";
import { Todo } from "../models/todo";
import { success, created, notFound } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

export async function getAll(_req: Request, res: Response) {
  const todos = await Todo.find().sort({ createdAt: -1 }).lean();
  return success(res, todos);
}

export async function create(req: Request, res: Response) {
  const { task, notes } = req.body;
  if (!task?.trim()) throw new AppError(400, "Task is required");
  const todo = await Todo.create({ task: task.trim(), notes });
  return created(res, todo);
}

export async function update(req: Request, res: Response) {
  const { task, done, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (task !== undefined) updates.task = task;
  if (done !== undefined) updates.done = done;
  if (notes !== undefined) updates.notes = notes;
  const todo = await Todo.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
  if (!todo) return notFound(res, "Todo not found");
  return success(res, todo);
}

export async function remove(req: Request, res: Response) {
  const todo = await Todo.findByIdAndDelete(req.params.id).lean();
  if (!todo) return notFound(res, "Todo not found");
  return success(res, todo, "Deleted successfully");
}
