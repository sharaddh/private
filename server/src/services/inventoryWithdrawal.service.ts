import mongoose from "mongoose";
import { Inventory } from "../models/inventory";
import { InventoryWithdrawal } from "../models/inventoryWithdrawal";
import { AppError } from "../middleware/errorHandler";
import { paginateQuery, PaginationOptions } from "../utils/pagination";

const HISTORY_CAP = 100;

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

  const docItems: Array<Record<string, unknown>> = [];
  for (const it of items) {
    const item = await Inventory.findOne({ sku: it.sku }).lean();
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
    const entry = { qty: -it.qty, type: "withdraw", note, by, at };
    const res = await Inventory.findOneAndUpdate(
      { sku: it.sku, quantity: { $gte: it.qty } },
      {
        $inc: { quantity: -it.qty },
        $push: { stockHistory: { $each: [entry], $slice: -HISTORY_CAP } },
      },
      { new: true }
    ).lean();
    if (!res) {
      throw new AppError(
        400,
        `Insufficient stock for "${it.sku}". Stock changed while withdrawing; please review and retry.`
      );
    }
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalPrice = items.reduce((s, it) => s + it.qty * it.price, 0);

  return InventoryWithdrawal.create({ items: docItems, note, by, totalQty, totalPrice });
}

export async function listInventoryWithdrawals(options: PaginationOptions = {}) {
  const baseQuery = InventoryWithdrawal.find() as mongoose.Query<any[], any>;
  return paginateQuery(baseQuery, {
    page: options.page,
    limit: options.limit,
  });
}

export async function getInventoryWithdrawalById(id: string) {
  const doc = await InventoryWithdrawal.findById(id).lean();
  if (!doc) throw new AppError(404, "Withdrawal not found");
  return doc;
}
