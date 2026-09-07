import { Prisma, prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";

const Inventory = prisma.warehouseInventory;

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

function toMongoDoc(row: any) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, _id: id };
}

function isNotFound(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export async function getStats() {
  const [totalItems, lowStock, warehouseItems, allForValue, recentItems] = await Promise.all([
    Inventory.count(),
    Inventory.count({ where: { quantity: { lte: 5 } } }),
    Inventory.count({ where: { location: "warehouse" } }),
    Inventory.findMany({ select: { quantity: true, sellingPrice: true } }),
    Inventory.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const totalValue = allForValue.reduce(
    (s, i) => s + (i.quantity || 0) * (i.sellingPrice || 0),
    0
  );

  return {
    totalItems,
    lowStock,
    warehouseItems,
    totalValue,
    recentItems: recentItems.map(toMongoDoc),
  };
}

export async function listInventory(query?: { search?: string }) {
  const where: Prisma.WarehouseInventoryWhereInput = {};
  const s = query?.search?.trim();
  if (s) {
    where.OR = [
      { sku: { contains: s, mode: "insensitive" } },
      { brand: { contains: s, mode: "insensitive" } },
      { model: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
      { supplier: { contains: s, mode: "insensitive" } },
    ];
  }
  const items = await Inventory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return items.map(toMongoDoc);
}

export async function getInventoryById(id: string) {
  const item = await Inventory.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Inventory item not found");
  return toMongoDoc(item);
}

export async function getInventoryBySku(code: string) {
  const item = await Inventory.findUnique({ where: { sku: code } });
  if (!item) throw new AppError(404, "Inventory item not found");
  return toMongoDoc(item);
}

export async function getQrImage(id: string) {
  const item = await Inventory.findUnique({ where: { id }, select: { sku: true } });
  if (!item) throw new AppError(404, "Inventory item not found");
  return { sku: item.sku };
}

export async function createInventory(data: InventoryData) {
  const item = await Inventory.create({
    data: data as Prisma.WarehouseInventoryCreateInput,
  });
  return toMongoDoc(item);
}

export async function adjustStock(id: string, quantity: number) {
  const item = await Inventory.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Inventory item not found");
  const newQty = item.quantity + quantity;
  if (newQty < 0) throw new AppError(400, "Stock cannot go below zero");
  const updated = await Inventory.update({ where: { id }, data: { quantity: newQty } });
  return toMongoDoc(updated);
}

export async function updateInventory(id: string, updates: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in updates) {
      filtered[key] = updates[key];
    }
  }
  try {
    const item = await Inventory.update({
      where: { id },
      data: filtered as Prisma.WarehouseInventoryUpdateInput,
    });
    return toMongoDoc(item);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Inventory item not found");
    throw err;
  }
}

export async function deleteInventory(id: string) {
  try {
    const item = await Inventory.delete({ where: { id } });
    return toMongoDoc(item);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Inventory item not found");
    throw err;
  }
}