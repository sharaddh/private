import { Todo } from "../models/todo";
import { AppError } from "../middleware/errorHandler";
import { requireBranchId } from "../utils/scope";

interface TodoData {
  task?: string;
  done?: boolean;
  notes?: string;
}

export async function listTodos() {
  return Todo.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createTodo(data: TodoData) {
  if (!data.task?.trim()) throw new AppError(400, "Task is required");
  return Todo.create({ data: { task: data.task.trim(), notes: data.notes, branchId: requireBranchId() } });
}

export async function updateTodo(id: string, data: TodoData) {
  const existing = await Todo.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Todo not found");

  const updates: Record<string, unknown> = {};
  if (data.task !== undefined) updates.task = data.task;
  if (data.done !== undefined) updates.done = data.done;
  if (data.notes !== undefined) updates.notes = data.notes;

  return Todo.update({ where: { id }, data: updates });
}

export async function deleteTodo(id: string) {
  const existing = await Todo.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Todo not found");

  await Todo.delete({ where: { id } });
  return existing;
}
