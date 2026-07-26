import { Request, Response } from "express";
import * as warehouseAgg from "../services/warehouseAggregate.service";
import { sendSuccess } from "../utils/response";

export async function getStats(_req: Request, res: Response) {
  const data = await warehouseAgg.getAllBranchStats();
  sendSuccess(res, data);
}

export async function listInventory(req: Request, res: Response) {
  const { search } = req.query;
  const data = await warehouseAgg.getAllBranchInventory({ search: search as string });
  sendSuccess(res, data);
}

export async function listLensStock(_req: Request, res: Response) {
  const data = await warehouseAgg.getAllBranchLensStock();
  sendSuccess(res, data);
}
