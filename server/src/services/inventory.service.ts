import mongoose from "mongoose";
import { Inventory } from "../models/inventory";
import { escapeRegex } from "../utils/string";
import { AppError } from "../middleware/errorHandler";
import { paginateQuery, PaginationOptions } from "../utils/pagination";
import { VALID_INVENTORY_CATEGORIES, VALID_INVENTORY_TYPES, VALID_GENDERS, VALID_LOCATIONS } from "../types";
import { z } from "zod";

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
  lensIndex?: string;
  lensCoating?: string;
  sphRight?: string;
  cylRight?: string;
  axisRight?: string;
  sphLeft?: string;
  cylLeft?: string;
  axisLeft?: string;
  addPower?: string;
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
  "lensIndex",
  "lensCoating",
  "sphRight",
  "cylRight",
  "axisRight",
  "sphLeft",
  "cylLeft",
  "axisLeft",
  "addPower",
] as const;

const HISTORY_CAP = 100;

function isDuplicateKeyError(err: unknown): boolean {
  return !!(err && typeof err === "object" && (err as { code?: number }).code === 11000);
}

export async function getStats(thresholdStr?: string, location?: string) {
  const threshold = Math.max(parseInt(thresholdStr || "5", 10) || 5, 0);
  const locationFilter = location && ["shop", "warehouse"].includes(location) ? { location } : {};
  const [totalItems, lowStock, warehouseItems, totalValueResult, recentItems, byCategory] = await Promise.all([
    Inventory.countDocuments(locationFilter),
    Inventory.countDocuments({ ...locationFilter, quantity: { $lte: threshold } }),
    Inventory.countDocuments({ ...locationFilter, location: "warehouse" }),
    Inventory.aggregate([
      { $match: locationFilter },
      { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } },
    ]),
    Inventory.find(locationFilter).sort({ createdAt: -1 }).limit(5).lean(),
    Inventory.aggregate([
      { $match: locationFilter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const c of byCategory) {
    if (c._id) categoryCounts[c._id] = c.count;
  }

  return {
    totalItems,
    lowStock,
    lowStockThreshold: threshold,
    warehouseItems,
    totalValue: totalValueResult[0]?.total || 0,
    recentItems,
    categoryCounts,
  };
}

export interface ListInventoryOptions extends PaginationOptions {
  search?: string;
  category?: string;
  location?: string;
  lowStock?: boolean;
  threshold?: string;
}

export async function listInventory(options: ListInventoryOptions = {}) {
  const filter: Record<string, unknown> = {};
  if (options.search) {
    const s = escapeRegex(options.search.trim());
    const searchRegex = { $regex: s, $options: "i" };
    filter.$or = [
      { sku: searchRegex },
      { brand: searchRegex },
      { model: searchRegex },
      { category: searchRegex },
      { supplier: searchRegex },
      { color: searchRegex },
      { size: searchRegex },
      { inventoryType: searchRegex },
      { description: searchRegex },
    ];
  }
  if (options.category) filter.category = options.category;
  if (options.location) filter.location = options.location;
  if (options.lowStock) {
    const t = Math.max(parseInt(options.threshold || "5", 10) || 5, 0);
    filter.quantity = { $lte: t };
  }

  const legacyMode = !options.page && !options.limit;
  if (legacyMode) {
    return Inventory.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  }

  const baseQuery = Inventory.find(filter) as mongoose.Query<any[], any>;
  return paginateQuery(baseQuery, {
    page: options.page,
    limit: options.limit,
  });
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

export async function skuExists(code?: string) {
  const trimmed = (code || "").trim();
  if (!trimmed) return { exists: false, item: null };
  const item = await Inventory.findOne({
    sku: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") },
  }).lean();
  return { exists: !!item, item: item || null };
}

export async function getQrImage(id: string) {
  const item = await Inventory.findById(id).select("sku").lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return { sku: item.sku };
}

export async function createInventory(data: InventoryData) {
  try {
    return await Inventory.create(data);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(400, `SKU "${data.sku}" already exists`);
    throw err;
  }
}

export async function adjustStock(id: string, quantity: number, note?: string, by?: string) {
  const item = await Inventory.findById(id);
  if (!item) throw new AppError(404, "Inventory item not found");
  const newQty = item.quantity + quantity;
  if (newQty < 0) throw new AppError(400, "Stock cannot go below zero");
  item.quantity = newQty;
  item.stockHistory = [
    ...(item.stockHistory || []),
    { qty: quantity, type: "adjust" as const, note: note || "", by: by || "", at: new Date() },
  ].slice(-HISTORY_CAP);
  await item.save();
  return item;
}

export interface StockItemRef {
  sku?: string;
  quantity?: number;
}

export interface OrderStockRef {
  frame?: string;
  lens?: string;
  accessories?: string[];
  quantity?: number;
  stockItems?: StockItemRef[];
}

function collectStockRefs(order: OrderStockRef): Array<{ code: string; qty: number }> {
  if (Array.isArray(order.stockItems) && order.stockItems.length > 0) {
    return order.stockItems
      .filter((it) => it && typeof it.sku === "string" && it.sku.trim().length > 0)
      .map((it) => ({
        code: it.sku as string,
        qty: Math.max(1, Math.trunc(Number(it.quantity) || 1)),
      }));
  }
  const qty = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  const refs: Array<{ code: string; qty: number }> = [];
  if (order.frame) refs.push({ code: order.frame, qty });
  if (order.lens) refs.push({ code: order.lens, qty: 1 });
  for (const name of order.accessories || []) {
    if (name) refs.push({ code: name, qty: 1 });
  }
  return refs;
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
  for (const ref of collectStockRefs(order)) {
    await applyStockDelta(ref.code, -ref.qty, session);
  }
}

export async function assertStockAvailable(
  order: OrderStockRef,
  session?: mongoose.ClientSession | null
): Promise<void> {
  for (const ref of collectStockRefs(order)) {
    const opts = { session: session || undefined };
    let item = await Inventory.findOne({ sku: ref.code }, null, opts).lean();
    if (!item) {
      item = await Inventory.findOne(
        { model: { $regex: new RegExp(`^${escapeRegex(ref.code)}$`, "i") } },
        null,
        opts
      ).lean();
    }
    if (item && (item.quantity || 0) < ref.qty) {
      const name = item.brand || item.model || item.sku;
      throw new AppError(
        400,
        `Insufficient stock for "${name}". Available: ${item.quantity || 0}, required: ${ref.qty}`
      );
    }
  }
}

export async function restoreStockForOrder(
  order: OrderStockRef,
  session?: mongoose.ClientSession | null
): Promise<void> {
  for (const ref of collectStockRefs(order)) {
    await applyStockDelta(ref.code, ref.qty, session);
  }
}

export async function updateInventory(id: string, updates: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in updates) {
      filtered[key] = updates[key];
    }
  }
  try {
    const item = await Inventory.findByIdAndUpdate(id, { $set: filtered }, { new: true, runValidators: true }).lean();
    if (!item) throw new AppError(404, "Inventory item not found");
    return item;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(400, `SKU already exists`);
    throw err;
  }
}

export async function deleteInventory(id: string) {
  const item = await Inventory.findByIdAndDelete(id).lean();
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

const importRowSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  category: z.enum(VALID_INVENTORY_CATEGORIES).optional(),
  inventoryType: z.enum(VALID_INVENTORY_TYPES).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  gender: z.enum(VALID_GENDERS).optional(),
  supplier: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().optional(),
  location: z.enum(VALID_LOCATIONS).optional(),
});

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importInventory(
  rows: unknown[],
  meta: { note?: string; by?: string } = {}
): Promise<ImportResult> {
  const ops: Array<Record<string, unknown>> = [];
  const errors: Array<{ row: number; message: string }> = [];
  const at = new Date();

  rows.forEach((raw, idx) => {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: idx + 1, message: parsed.error.issues[0]?.message || "Invalid row" });
      return;
    }
    const row = parsed.data;
    const qty = row.quantity ?? 0;
    const historyEntry = { qty, type: "import", note: meta.note || "", by: meta.by || "", at };
    ops.push({
      updateOne: {
        filter: { sku: row.sku },
        update: {
          $inc: { quantity: qty },
          $set: {
            ...(row.brand !== undefined ? { brand: row.brand } : {}),
            ...(row.model !== undefined ? { model: row.model } : {}),
            ...(row.color !== undefined ? { color: row.color } : {}),
            ...(row.size !== undefined ? { size: row.size } : {}),
            ...(row.supplier !== undefined ? { supplier: row.supplier } : {}),
            ...(row.description !== undefined ? { description: row.description } : {}),
            ...(row.category !== undefined ? { category: row.category } : {}),
            ...(row.inventoryType !== undefined ? { inventoryType: row.inventoryType } : {}),
            ...(row.gender !== undefined ? { gender: row.gender } : {}),
            ...(row.location !== undefined ? { location: row.location } : {}),
            ...(row.purchasePrice !== undefined ? { purchasePrice: row.purchasePrice } : {}),
            ...(row.sellingPrice !== undefined ? { sellingPrice: row.sellingPrice } : {}),
          },
          $push: { stockHistory: { $each: [historyEntry], $slice: -HISTORY_CAP } },
          $setOnInsert: { sku: row.sku },
        },
        upsert: true,
      },
    });
  });

  if (ops.length === 0) {
    return { created: 0, updated: 0, skipped: errors.length, errors };
  }

  const result = await Inventory.bulkWrite(ops as mongoose.AnyBulkWriteOperation[], { ordered: false });
  return {
    created: result.upsertedCount || 0,
    updated: result.modifiedCount || 0,
    skipped: errors.length,
    errors,
  };
}
