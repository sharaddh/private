import { Request, Response } from "express";
import * as warehouseLensStockService from "../services/warehouseLensStock.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const data = await warehouseLensStockService.listLensStock();
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await warehouseLensStockService.getLensStockById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const { coating } = req.body;
  if (!coating || typeof coating !== "string" || !coating.trim()) {
    res.status(400).json({ success: false, message: "Coating name is required" });
    return;
  }
  const data = await warehouseLensStockService.createLensStock(coating.trim());
  sendCreated(res, data);
}

export async function rename(req: Request, res: Response) {
  const { coating } = req.body;
  if (!coating || typeof coating !== "string" || !coating.trim()) {
    res.status(400).json({ success: false, message: "Coating name is required" });
    return;
  }
  const data = await warehouseLensStockService.renameLensStock(req.params.id, coating.trim());
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await warehouseLensStockService.deleteLensStock(req.params.id);
  sendSuccess(res, null, "Coating deleted");
}

export async function updateQuantity(req: Request, res: Response) {
  const { lensType, powerKey, quantity } = req.body;
  if (!lensType || !powerKey || typeof quantity !== "number") {
    res.status(400).json({ success: false, message: "lensType, powerKey, and quantity are required" });
    return;
  }
  if (!["sph", "cyl", "compound"].includes(lensType)) {
    res.status(400).json({ success: false, message: "lensType must be sph, cyl, or compound" });
    return;
  }
  const data = await warehouseLensStockService.updateQuantity(req.params.id, lensType, powerKey, quantity);
  sendSuccess(res, data);
}

export async function bulkUpdate(req: Request, res: Response) {
  const { lensType, updates } = req.body;
  if (!lensType || !updates || typeof updates !== "object") {
    res.status(400).json({ success: false, message: "lensType and updates are required" });
    return;
  }
  if (!["sph", "cyl", "compound"].includes(lensType)) {
    res.status(400).json({ success: false, message: "lensType must be sph, cyl, or compound" });
    return;
  }
  const data = await warehouseLensStockService.bulkUpdateQuantities(req.params.id, lensType, updates);
  sendSuccess(res, data);
}
