import { Request, Response } from "express";
import * as todoService from "../services/todo.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function getAll(_req: Request, res: Response) {
  const data = await todoService.listTodos();
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await todoService.createTodo(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await todoService.updateTodo(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await todoService.deleteTodo(req.params.id);
  sendSuccess(res, null, "Todo deleted");
}
