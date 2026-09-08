import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { paginateFind, PaginationOptions } from "../utils/pagination";
import {
  VALID_INVENTORY_CATEGORIES,
  VALID_INVENTORY_TYPES,
  VALID_GENDERS,
  VALID_LOCATIONS,
} from "../types";
import { z } from "zod";

interface InventoryData {
  branchId?: string;
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

function isDuplicateKeyError(err: unknown): boolean {
  return !!(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

export async function getStats(thresholdStr?: string, location?: string) {
  const threshold = Math.max(parseInt(thresholdStr || "5", 10) || 5, 0);
  const locationFilter: Prisma.InventoryWhereInput =
    location && ["shop", "warehouse"].includes(location) ? { location } : {};

  const [totalItems, lowStock, warehouseItems, recentItems, byCategory, valueItems] =
    await Promise.all([
      prisma.inventory.count({ where: locationFilter }),
      prisma.inventory.count({ where: { ...locationFilter, quantity: { lte: threshold } } }),
      prisma.inventory.count({ where: { ...locationFilter, location: "warehouse" } }),
      prisma.inventory.findMany({
        where: locationFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.inventory.groupBy({
        by: ["category"],
        where: locationFilter,
        _count: true,
      }),
      prisma.inventory.findMany({
        where: locationFilter,
        select: { quantity: true, sellingPrice: true },
      }),
    ]);

  const categoryCounts: Record<string, number> = {};
  for (const c of byCategory) {
    if (c.category) categoryCounts[c.category] = c._count;
  }

  const totalValue = valueItems.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0
  );

  return {
    totalItems,
    lowStock,
    lowStockThreshold: threshold,
    warehouseItems,
    totalValue,
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
  const where: Prisma.InventoryWhereInput = {};
  if (options.search) {
    const s = options.search.trim();
    where.OR = [
      { sku: { contains: s, mode: "insensitive" } },
      { brand: { contains: s, mode: "insensitive" } },
      { model: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
      { supplier: { contains: s, mode: "insensitive" } },
      { color: { contains: s, mode: "insensitive" } },
      { size: { contains: s, mode: "insensitive" } },
      { inventoryType: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }
  if (options.category) where.category = options.category;
  if (options.location) where.location = options.location;
  if (options.lowStock) {
    const t = Math.max(parseInt(options.threshold || "5", 10) || 5, 0);
    where.quantity = { lte: t };
  }

  const legacyMode = !options.page && !options.limit;
  if (legacyMode) {
    return prisma.inventory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  return paginateFind(
    (args) => prisma.inventory.findMany(args),
    (w) => prisma.inventory.count({ where: w }),
    { page: options.page, limit: options.limit },
    { where, orderBy: { createdAt: "desc" } }
  );
}

export async function getInventoryById(id: string) {
  const item = await prisma.inventory.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

export async function getInventoryBySku(code: string) {
  const item = await prisma.inventory.findFirst({ where: { sku: code } });
  if (!item) throw new AppError(404, "Inventory item not found");
  return item;
}

export async function skuExists(code?: string) {
  const trimmed = (code || "").trim();
  if (!trimmed) return { exists: false, item: null };
  const item = await prisma.inventory.findFirst({
    where: { sku: { equals: trimmed, mode: "insensitive" } },
  });
  return { exists: !!item, item: item || null };
}

export async function getQrImage(id: string) {
  const item = await prisma.inventory.findUnique({
    where: { id },
    select: { sku: true },
  });
  if (!item) throw new AppError(404, "Inventory item not found");
  return { sku: item.sku };
}

export async function createInventory(data: InventoryData) {
  try {
    return await prisma.inventory.create({ data: data as any });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(400, `SKU "${data.sku}" already exists`);
    throw err;
  }
}

export async function adjustStock(id: string, quantity: number, note?: string, by?: string) {
  const item = await prisma.inventory.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Inventory item not found");
  const newQty = item.quantity + quantity;
  if (newQty < 0) throw new AppError(400, "Stock cannot go below zero");
  return prisma.inventory.update({
    where: { id },
    data: { quantity: newQty },
  });
}

export interface StockItemRef {
  sku?: string;
  quantity?: number;
}

export interface OrderStockRef {
  frame?: string | null;
  lens?: string | null;
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

type StockDb = Prisma.TransactionClient;

async function applyStockDelta(
  code: string,
  delta: number,
  db: StockDb = prisma as unknown as StockDb
): Promise<void> {
  const amount = Number.isFinite(delta) ? delta : 0;
  if (!code || amount === 0) return;

  if (amount < 0) {
    const dec = -amount;
    const item = await db.inventory.findFirst({
      where: { sku: code, quantity: { gt: 0 } },
    });
    if (item) {
      const newQty = Math.max(0, item.quantity - dec);
      await db.inventory.update({ where: { id: item.id }, data: { quantity: newQty } });
    } else {
      const item2 = await db.inventory.findFirst({
        where: {
          model: { contains: code, mode: "insensitive" },
          quantity: { gt: 0 },
        },
      });
      if (item2) {
        const newQty = Math.max(0, item2.quantity - dec);
        await db.inventory.update({
          where: { id: item2.id },
          data: { quantity: newQty },
        });
      }
    }
  } else {
    const item = await db.inventory.findFirst({ where: { sku: code } });
    if (item) {
      await db.inventory.update({
        where: { id: item.id },
        data: { quantity: { increment: amount } },
      });
    } else {
      const item2 = await db.inventory.findFirst({
        where: { model: { contains: code, mode: "insensitive" } },
      });
      if (item2) {
        await db.inventory.update({
          where: { id: item2.id },
          data: { quantity: { increment: amount } },
        });
      }
    }
  }
}

export async function decrementStockForOrder(
  order: OrderStockRef,
  db?: StockDb
): Promise<void> {
  for (const ref of collectStockRefs(order)) {
    await applyStockDelta(ref.code, -ref.qty, db);
  }
}

export async function assertStockAvailable(
  order: OrderStockRef,
  db?: StockDb
): Promise<void> {
  const client = db ?? (prisma as unknown as StockDb);
  for (const ref of collectStockRefs(order)) {
    let item = await client.inventory.findFirst({ where: { sku: ref.code } });
    if (!item) {
      item = await client.inventory.findFirst({
        where: { model: { contains: ref.code, mode: "insensitive" } },
      });
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
  db?: StockDb
): Promise<void> {
  for (const ref of collectStockRefs(order)) {
    await applyStockDelta(ref.code, ref.qty, db);
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
    const existing = await prisma.inventory.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Inventory item not found");
    return prisma.inventory.update({ where: { id }, data: filtered as any });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(400, `SKU already exists`);
    throw err;
  }
}

export async function deleteInventory(id: string) {
  const existing = await prisma.inventory.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Inventory item not found");
  return prisma.$transaction(async (tx) => {
    await tx.inventoryMovementHistory.deleteMany({ where: { inventoryId: id } });
    return tx.inventory.delete({ where: { id } });
  });
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
  const errors: Array<{ row: number; message: string }> = [];
  const parsedRows: Array<{ row: number; data: z.infer<typeof importRowSchema> }> = [];

  rows.forEach((raw, idx) => {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: idx + 1, message: parsed.error.issues[0]?.message || "Invalid row" });
      return;
    }
    parsedRows.push({ row: idx + 1, data: parsed.data });
  });

  if (parsedRows.length === 0) {
    return { created: 0, updated: 0, skipped: errors.length, errors };
  }

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const { data: row } of parsedRows) {
      const qty = row.quantity ?? 0;
      const fields: Record<string, unknown> = {};
      if (row.brand !== undefined) fields.brand = row.brand;
      if (row.model !== undefined) fields.model = row.model;
      if (row.color !== undefined) fields.color = row.color;
      if (row.size !== undefined) fields.size = row.size;
      if (row.supplier !== undefined) fields.supplier = row.supplier;
      if (row.description !== undefined) fields.description = row.description;
      if (row.category !== undefined) fields.category = row.category;
      if (row.inventoryType !== undefined) fields.inventoryType = row.inventoryType;
      if (row.gender !== undefined) fields.gender = row.gender;
      if (row.location !== undefined) fields.location = row.location;
      if (row.purchasePrice !== undefined) fields.purchasePrice = row.purchasePrice;
      if (row.sellingPrice !== undefined) fields.sellingPrice = row.sellingPrice;

      const existing = await tx.inventory.findFirst({ where: { sku: row.sku } });
      if (existing) {
        await tx.inventory.update({
          where: { id: existing.id },
          data: { ...fields, quantity: { increment: qty } },
        });
        updated++;
      } else {
        await tx.inventory.create({
          data: { sku: row.sku, quantity: qty, ...fields } as any,
        });
        created++;
      }
    }
  });

  return {
    created,
    updated,
    skipped: errors.length,
    errors,
  };
}
