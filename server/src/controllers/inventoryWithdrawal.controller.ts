import { Request, Response } from "express";
import * as withdrawalService from "../services/inventoryWithdrawal.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { AuthRequest } from "../types";

export async function list(req: Request, res: Response) {
  const { page, limit } = req.query;
  const data = await withdrawalService.listInventoryWithdrawals({
    page: page as string | undefined,
    limit: limit as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await withdrawalService.getInventoryWithdrawalById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await withdrawalService.createInventoryWithdrawal({ ...req.body, by });
  sendCreated(res, data);
}
