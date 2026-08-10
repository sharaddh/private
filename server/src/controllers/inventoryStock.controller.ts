import { Request, Response } from "express";
import * as inventoryStockService from "../services/inventoryStock.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { AuthRequest } from "../types";

export async function addStock(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryStockService.addStock(req.body, by);
  sendSuccess(res, data, "Stock added");
}

export async function createVariantWithStock(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryStockService.createVariantWithStock(req.body, by);
  sendCreated(res, data, "Variant created with stock");
}

export async function withdrawStock(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryStockService.withdrawStock(req.body, by);
  sendCreated(res, data, "Stock withdrawn");
}

export async function reverseWithdrawal(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryStockService.reverseWithdrawal(req.params.id, by);
  sendSuccess(res, data, "Withdrawal reversed");
}

export async function adjustStock(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryStockService.adjustStock(req.params.id, req.body.quantity, req.body.note, by);
  sendSuccess(res, data, "Stock adjusted");
}

export async function listWithdrawals(req: Request, res: Response) {
  const { page, limit, reason, by, search } = req.query;
  const data = await inventoryStockService.listWithdrawals({
    page: page as string | undefined,
    limit: limit as string | undefined,
    reason: reason as string | undefined,
    by: by as string | undefined,
    search: search as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getWithdrawal(req: Request, res: Response) {
  const data = await inventoryStockService.getWithdrawalById(req.params.id);
  sendSuccess(res, data);
}

export async function listMovements(req: Request, res: Response) {
  const { variantId, sku, type, user, rack, startDate, endDate, page, limit } = req.query;
  const data = await inventoryStockService.listMovements({
    variantId: variantId as string | undefined,
    sku: sku as string | undefined,
    type: type as string | undefined,
    user: user as string | undefined,
    rack: rack as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    page: page as string | undefined,
    limit: limit as string | undefined,
  });
  sendSuccess(res, data);
}
