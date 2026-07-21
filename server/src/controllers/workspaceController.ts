import { BranchRequest } from "../types";
import { Response } from "express";
import { executeTransaction, sendBillWhatsApp } from "../services/workspace.service";
import { sendSuccess, sendCreated, sendNotFound } from "../utils/response";
import * as todoService from "../services/todo.service";

export async function transaction(req: BranchRequest, res: Response) {
  const data = await executeTransaction(req.body, req.branchId);
  const bill = data.bill as any;
  const customer = data.customer as any;
  if (bill && customer) {
    sendBillWhatsApp(bill, customer, req.branchId);
  }
  sendSuccess(res, data, "Transaction completed");
}

export async function listTodos(_req: BranchRequest, res: Response) {
  const todos = await todoService.listTodos();
  sendSuccess(res, todos);
}

export async function createTodo(req: BranchRequest, res: Response) {
  const todo = await todoService.createTodo(req.body);
  sendCreated(res, todo, "Todo created");
}

export async function toggleTodo(req: BranchRequest, res: Response) {
  const todo = await todoService.updateTodo(req.params.id, { done: !!req.body.done });
  sendSuccess(res, todo);
}

export async function deleteTodo(req: BranchRequest, res: Response) {
  await todoService.deleteTodo(req.params.id);
  sendSuccess(res, null, "Todo deleted");
}
