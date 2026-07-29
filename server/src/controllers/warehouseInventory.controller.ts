import { Request, Response } from "express";
import * as warehouseInventoryService from "../services/warehouseInventory.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function getStats(_req: Request, res: Response) {
  const data = await warehouseInventoryService.getStats();
  sendSuccess(res, data);
}

export async function list(req: Request, res: Response) {
  const { search } = req.query;
  const data = await warehouseInventoryService.listInventory({ search: search as string });
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await warehouseInventoryService.getInventoryById(req.params.id);
  sendSuccess(res, data);
}

export async function getBySku(req: Request, res: Response) {
  const data = await warehouseInventoryService.getInventoryBySku(req.params.sku);
  sendSuccess(res, data);
}

export async function getQrImage(req: Request, res: Response) {
  const QRCode = await import("qrcode");
  const item = await warehouseInventoryService.getQrImage(req.params.id);
  if (!item.sku) {
    res.status(400).json({ success: false, message: "Item has no SKU" });
    return;
  }
  const buffer = await QRCode.default.toBuffer(item.sku, { type: "png", width: 300 });
  res.set("Content-Type", "image/png");
  res.send(buffer);
}

export async function create(req: Request, res: Response) {
  const data = await warehouseInventoryService.createInventory(req.body);
  sendCreated(res, data);
}

export async function adjustStock(req: Request, res: Response) {
  const { quantity } = req.body;
  const data = await warehouseInventoryService.adjustStock(req.params.id, quantity);
  sendSuccess(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await warehouseInventoryService.updateInventory(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await warehouseInventoryService.deleteInventory(req.params.id);
  sendSuccess(res, null, "Inventory item deleted");
}
