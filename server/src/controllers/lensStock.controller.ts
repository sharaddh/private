import { Request, Response } from "express";
import * as lensStockService from "../services/lensStock.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const data = await lensStockService.listLensStock();
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await lensStockService.getLensStockById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const { coating, price } = req.body;
  if (!coating || typeof coating !== "string" || !coating.trim()) {
    res.status(400).json({ success: false, message: "Coating name is required" });
    return;
  }
  let parsedPrice = 0;
  if (price !== undefined) {
    parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ success: false, message: "Price must be a non-negative number" });
      return;
    }
  }
  const data = await lensStockService.createLensStock(coating.trim(), parsedPrice);
  sendCreated(res, data);
}

export async function rename(req: Request, res: Response) {
  const { coating, price } = req.body;
  if (!coating || typeof coating !== "string" || !coating.trim()) {
    res.status(400).json({ success: false, message: "Coating name is required" });
    return;
  }
  let parsedPrice: number | undefined;
  if (price !== undefined) {
    parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ success: false, message: "Price must be a non-negative number" });
      return;
    }
  }
  const data = await lensStockService.renameLensStock(req.params.id, coating.trim(), parsedPrice);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await lensStockService.deleteLensStock(req.params.id);
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
  const data = await lensStockService.updateQuantity(req.params.id, lensType, powerKey, quantity);
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
  const data = await lensStockService.bulkUpdateQuantities(req.params.id, lensType, updates);
  sendSuccess(res, data);
}
