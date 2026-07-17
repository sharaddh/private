import { Todo } from "../models/todo";
import { AppError } from "../middleware/errorHandler";

interface TodoData {
  task?: string;
  done?: boolean;
  notes?: string;
}

export async function listTodos() {
  return Todo.find().sort({ createdAt: -1 }).lean();
}

export async function createTodo(data: TodoData) {
  if (!data.task?.trim()) throw new AppError(400, "Task is required");
  return Todo.create({ task: data.task.trim(), notes: data.notes });
}

export async function updateTodo(id: string, data: TodoData) {
  const updates: Record<string, unknown> = {};
  if (data.task !== undefined) updates.task = data.task;
  if (data.done !== undefined) updates.done = data.done;
  if (data.notes !== undefined) updates.notes = data.notes;

  const todo = await Todo.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  if (!todo) throw new AppError(404, "Todo not found");
  return todo;
}

export async function deleteTodo(id: string) {
  const todo = await Todo.findByIdAndDelete(id).lean();
  if (!todo) throw new AppError(404, "Todo not found");
  return todo;
}
