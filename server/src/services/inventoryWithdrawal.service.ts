import { Inventory } from "../models/inventory";
import { InventoryWithdrawal } from "../models/inventoryWithdrawal";
import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import { requireBranchId } from "../utils/scope";
import { paginateFind, PaginationOptions } from "../utils/pagination";

export interface WithdrawalItemInput {
  sku: string;
  qty: number;
  price?: number;
}

export interface CreateWithdrawalInput {
  items: WithdrawalItemInput[];
  note?: string;
  by?: string;
}

export async function createInventoryWithdrawal(input: CreateWithdrawalInput) {
  const map = new Map<string, { sku: string; qty: number; price: number }>();
  for (const raw of input.items || []) {
    const sku = String(raw.sku || "").trim();
    if (!sku) throw new AppError(400, "Each item must have a SKU");
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1) {
      throw new AppError(400, `Quantity for "${sku}" must be at least 1`);
    }
    const price = Math.max(Number(raw.price) || 0, 0);
    const existing = map.get(sku);
    if (existing) {
      existing.qty += qty;
      existing.price = Math.max(existing.price, price);
    } else {
      map.set(sku, { sku, qty, price });
    }
  }

  const items = [...map.values()];
  if (items.length === 0) throw new AppError(400, "No items to withdraw");

  const by = input.by || "";
  const note = input.note || "";
  const at = new Date();

  const docItems: Array<{
    sku: string;
    brand: string;
    model: string;
    color: string;
    category: string;
    qty: number;
    price: number;
  }> = [];
  for (const it of items) {
    const item = await Inventory.findFirst({ where: { sku: it.sku } });
    if (!item) throw new AppError(404, `Inventory item "${it.sku}" not found`);
    if ((item.quantity || 0) < it.qty) {
      const name = item.brand || item.model || item.sku;
      throw new AppError(
        400,
        `Insufficient stock for "${name}". Available: ${item.quantity || 0}, required: ${it.qty}`
      );
    }
    docItems.push({
      sku: item.sku,
      brand: item.brand || "",
      model: item.model || "",
      color: item.color || "",
      category: item.category || "",
      qty: it.qty,
      price: it.price,
    });
  }

  for (const it of items) {
    const inv = await Inventory.findFirst({
      where: { sku: it.sku, quantity: { gte: it.qty } },
    });
    if (!inv) {
      throw new AppError(
        400,
        `Insufficient stock for "${it.sku}". Stock changed while withdrawing; please review and retry.`
      );
    }
    await Inventory.update({
      where: { id: inv.id },
      data: { quantity: { decrement: it.qty } },
    });
    await prisma.inventoryMovementHistory.create({
      data: {
        inventoryId: inv.id,
        qty: -it.qty,
        type: "withdraw",
        note,
        by,
        at,
      },
    });
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalPrice = items.reduce((s, it) => s + it.qty * it.price, 0);

  return InventoryWithdrawal.create({
    data: {
      branchId: requireBranchId(),
      note,
      by,
      totalQty,
      totalPrice,
      items: {
        create: docItems.map((di) => ({
          sku: di.sku,
          brand: di.brand,
          model: di.model,
          color: di.color,
          category: di.category,
          qty: di.qty,
          price: di.price,
        })),
      },
    },
    include: { items: true },
  });
}

export async function listInventoryWithdrawals(options: PaginationOptions = {}) {
  return paginateFind(
    (args) => InventoryWithdrawal.findMany({ ...args }),
    (where) => InventoryWithdrawal.count({ where }),
    { page: options.page, limit: options.limit },
    { orderBy: { createdAt: "desc" } }
  );
}

export async function getInventoryWithdrawalById(id: string) {
  const doc = await InventoryWithdrawal.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!doc) throw new AppError(404, "Withdrawal not found");
  return doc;
}
