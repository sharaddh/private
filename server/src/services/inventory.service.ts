import mongoose from "mongoose";
import { Inventory } from "../models/inventory";
import { AppError } from "../middleware/errorHandler";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface InventoryData {
  sku?: string;
  category?: string;
  inventoryType?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  gender?: string;
  supplier?: string;
  quantity?: number;
  location?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
}

const UPDATE_WHITELIST = [
  "sku",
  "category",
  "inventoryType",
  "brand",
  "model",
  "color",
  "size",
  "gender",
  "supplier",
  "quantity",
  "location",
  "purchasePrice",
  "sellingPrice",
  "description",
] as const;

export async function getStats() {
  const [totalItems, lowStock, warehouseItems, totalValueResult, recentItems] = await Promise.all([
    Inventory.countDocuments(),
    Inventory.countDocuments({ quantity: { $lte: 5 } }),
    Inventory.countDocuments({ location: "warehouse" }),
    Inventory.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } },
    ]),
    Inventory.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return {
    totalItems,
    lowStock,
    warehouseItems,
    totalValue: totalValueResult[0]?.total || 0,
    recentItems,
  };
}

export async function listInventory(query?: { search?: string }) {
  const filter: Record<string, unknown> = {};
  if (query?.search) {
    const s = escapeRegex(query.search.trim());
    const searchRegex = { $regex: s, $options: "i" };
    filter.$or = [
      { sku: searchRegex },
      { brand: searchRegex },
      { model: searchRegex },
      { category: searchRegex },
      { supplier: searchRegex },
    ];
  }
  return Inventory.find(filter).sort({ createdAt: -1 }).limit(200).lean();
}

export async function getInventoryById(id: string) {
  const item = await Inventory.findById(id).lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

export async function getInventoryBySku(code: string) {
  const item = await Inventory.findOne({ sku: code }).lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

export async function getQrImage(id: string) {
  const item = await Inventory.findById(id).select("sku").lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return { sku: item.sku };
}

export async function createInventory(data: InventoryData) {
  return Inventory.create(data);
}

export async function adjustStock(id: string, quantity: number) {
  const item = await Inventory.findById(id);
  if (!item) throw new AppError(404, "Inventory item not found");
  const newQty = item.quantity + quantity;
  if (newQty < 0) throw new AppError(400, "Stock cannot go below zero");
  item.quantity = newQty;
  await item.save();
  return item;
}

export async function updateInventory(id: string, updates: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in updates) {
      filtered[key] = updates[key];
    }
  }
  const item = await Inventory.findByIdAndUpdate(id, { $set: filtered }, { new: true, runValidators: true }).lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

export async function deleteInventory(id: string) {
  const item = await Inventory.findByIdAndDelete(id).lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}
