import mongoose from "mongoose";
import { Inventory } from "../models/inventory";
import { escapeRegex } from "../utils/string";
import { AppError } from "../middleware/errorHandler";

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
  return Inventory.find(filter).sort({ createdAt: -1 }).limit(Math.min(200, 200)).lean();
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

interface OrderStockRef {
  frame?: string;
  lens?: string;
  accessories?: string[];
  quantity?: number;
}

async function applyStockDelta(
  code: string,
  delta: number,
  session?: mongoose.ClientSession | null
): Promise<void> {
  const amount = Number.isFinite(delta) ? delta : 0;
  if (!code || amount === 0) return;

  const opts = { session: session || undefined, new: true };
  if (amount < 0) {
    const dec = -amount;
    const pipeline = [
      { $set: { quantity: { $max: [{ $subtract: ["$quantity", dec] }, 0] } } },
    ];
    let res = await Inventory.findOneAndUpdate(
      { sku: code, quantity: { $gt: 0 } },
      pipeline,
      opts
    ).lean();
    if (!res) {
      res = await Inventory.findOneAndUpdate(
        { model: { $regex: new RegExp(`^${escapeRegex(code)}$`, "i") }, quantity: { $gt: 0 } },
        pipeline,
        opts
      ).lean();
    }
  } else {
    let res = await Inventory.findOneAndUpdate(
      { sku: code },
      { $inc: { quantity: amount } },
      opts
    ).lean();
    if (!res) {
      res = await Inventory.findOneAndUpdate(
        { model: { $regex: new RegExp(`^${escapeRegex(code)}$`, "i") } },
        { $inc: { quantity: amount } },
        opts
      ).lean();
    }
  }
}

export async function decrementStockForOrder(
  order: OrderStockRef,
  session?: mongoose.ClientSession | null
): Promise<void> {
  const qty = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  if (order.frame) await applyStockDelta(order.frame, -qty, session);
  if (order.lens) await applyStockDelta(order.lens, -1, session);
  for (const name of order.accessories || []) {
    if (name) await applyStockDelta(name, -1, session);
  }
}

export async function assertStockAvailable(
  order: OrderStockRef,
  session?: mongoose.ClientSession | null
): Promise<void> {
  const qty = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  const refs: Array<{ code: string; needed: number; label: string }> = [];
  if (order.frame) refs.push({ code: order.frame, needed: qty, label: "Frame" });
  if (order.lens) refs.push({ code: order.lens, needed: 1, label: "Lens" });
  for (const name of order.accessories || []) {
    if (name) refs.push({ code: name, needed: 1, label: "Accessory" });
  }

  for (const ref of refs) {
    const opts = { session: session || undefined };
    let item = await Inventory.findOne({ sku: ref.code }, null, opts).lean();
    if (!item) {
      item = await Inventory.findOne(
        { model: { $regex: new RegExp(`^${escapeRegex(ref.code)}$`, "i") } },
        null,
        opts
      ).lean();
    }
    if (item && (item.quantity || 0) < ref.needed) {
      const name = item.brand || item.model || item.sku;
      throw new AppError(
        400,
        `Insufficient stock for ${ref.label} "${name}". Available: ${item.quantity || 0}, required: ${ref.needed}`
      );
    }
  }
}

export async function restoreStockForOrder(
  order: OrderStockRef,
  session?: mongoose.ClientSession | null
): Promise<void> {
  const qty = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  if (order.frame) await applyStockDelta(order.frame, qty, session);
  if (order.lens) await applyStockDelta(order.lens, 1, session);
  for (const name of order.accessories || []) {
    if (name) await applyStockDelta(name, 1, session);
  }
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
