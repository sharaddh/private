import { Request, Response } from "express";
import * as inventoryService from "../services/inventory.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { AuthRequest } from "../types";

export async function getStats(req: Request, res: Response) {
  const threshold = req.query.threshold as string | undefined;
  const data = await inventoryService.getStats(threshold);
  sendSuccess(res, data);
}

export async function list(req: Request, res: Response) {
  const { search, q, category, location, lowStock, threshold, page, limit } = req.query;
  const data = await inventoryService.listInventory({
    search: (search || q) as string | undefined,
    category: category as string | undefined,
    location: location as string | undefined,
    lowStock: lowStock === "true" || lowStock === "1",
    threshold: threshold as string | undefined,
    page: page as string | undefined,
    limit: limit as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await inventoryService.getInventoryById(req.params.id);
  sendSuccess(res, data);
}

export async function getBySku(req: Request, res: Response) {
  const data = await inventoryService.getInventoryBySku(req.params.code);
  sendSuccess(res, data);
}

export async function getQrImage(req: Request, res: Response) {
  const QRCode = await import("qrcode");
  const item = await inventoryService.getQrImage(req.params.id);
  if (!item.sku) {
    res.status(400).json({ success: false, message: "Item has no SKU" });
    return;
  }
  const buffer = await QRCode.default.toBuffer(item.sku, { type: "png", width: 300 });
  res.set("Content-Type", "image/png");
  res.send(buffer);
}

export async function create(req: Request, res: Response) {
  const data = await inventoryService.createInventory(req.body);
  sendCreated(res, data);
}

export async function adjustStock(req: AuthRequest, res: Response) {
  const { quantity, note } = req.body;
  const by = req.user?.username || "";
  const data = await inventoryService.adjustStock(req.params.id, quantity, note, by);
  sendSuccess(res, data);
}

export async function bulkImport(req: AuthRequest, res: Response) {
  const { items, note } = req.body;
  const by = req.user?.username || "";
  const data = await inventoryService.importInventory(items || [], { note, by });
  sendSuccess(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await inventoryService.updateInventory(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await inventoryService.deleteInventory(req.params.id);
  sendSuccess(res, null, "Inventory item deleted");
}
