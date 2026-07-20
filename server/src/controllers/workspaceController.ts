import { BranchRequest } from "../types";
import { Response } from "express";
import { executeTransaction, sendBillWhatsApp } from "../services/workspace.service";
import { sendSuccess } from "../utils/response";
import { Todo } from "../models/todo";

export async function transaction(req: BranchRequest, res: Response) {
  const data = await executeTransaction(req.body, req.branchId);
  const bill = data.bill as any;
  const customer = data.customer as any;
  if (bill && customer) {
    sendBillWhatsApp(bill, customer, req.branchId);
  }
  sendSuccess(res, data, "Transaction completed");
}

export async function listTodos(req: BranchRequest, res: Response) {
  const todos = await (Todo as any).find({}).sort({ createdAt: -1 }).lean();
  sendSuccess(res, todos);
}

export async function createTodo(req: BranchRequest, res: Response) {
  const { task } = req.body;
  if (!task?.trim()) {
    res.status(400).json({ success: false, message: "Task is required" });
    return;
  }
  const todo = await (Todo as any).create({ task: task.trim() });
  sendSuccess(res, todo, "Todo created");
}

export async function toggleTodo(req: BranchRequest, res: Response) {
  const { id } = req.params;
  const { done } = req.body;
  const todo = await (Todo as any).findByIdAndUpdate(id, { done: !!done }, { new: true }).lean();
  if (!todo) {
    res.status(404).json({ success: false, message: "Todo not found" });
    return;
  }
  sendSuccess(res, todo);
}

export async function deleteTodo(req: BranchRequest, res: Response) {
  const { id } = req.params;
  const todo = await (Todo as any).findByIdAndDelete(id).lean();
  if (!todo) {
    res.status(404).json({ success: false, message: "Todo not found" });
    return;
  }
  sendSuccess(res, null, "Todo deleted");
}
