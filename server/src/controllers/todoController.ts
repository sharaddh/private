import { Request, Response, NextFunction } from "express";
import { Todo } from "../models/todo";
import { success, created, fail, notFound, serverError } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

export async function getAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    return success(res, todos);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { task, notes } = req.body;
    if (!task?.trim()) throw new AppError(400, "Task is required");
    const todo = await Todo.create({ task: task.trim(), notes });
    return created(res, todo);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!todo) return notFound(res, "Todo not found");
    return success(res, todo);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    if (!todo) return notFound(res, "Todo not found");
    return success(res, todo, "Deleted successfully");
  } catch (err) {
    next(err);
  }
}
