import { LensStock } from "../models/lensStock";
import { ShopCartItem } from "../models/shopLensCart";
import { ShopLensWithdrawal } from "../models/shopLensWithdrawal";
import { AppError } from "../middleware/errorHandler";
import { getPriceForPower } from "./lensStock.service";

export async function getCartItems(userId: string) {
  const items = await ShopCartItem.find({ user: userId }).sort({ createdAt: 1 }).lean();
  const coatingToStock = new Map<string, any>();
  for (const item of items) {
    if (!coatingToStock.has(item.coating)) {
      coatingToStock.set(item.coating, await LensStock.findOne({ coating: item.coating }));
    }
  }
  return items.map((item) => {
    const stock = coatingToStock.get(item.coating);
    const q = (stock?.quantities as Record<string, Record<string, number>>) || {};
    return { ...item, available: q[item.lensType]?.[item.powerKey] || 0 };
  });
}

export async function getCartCount(userId: string) {
  return ShopCartItem.countDocuments({ user: userId });
}

export async function addToCart(
  userId: string,
  coating: string,
  lensType: string,
  powerKey: string,
  quantity: number = 1
) {
  if (!["sph", "cyl", "compound"].includes(lensType)) {
    throw new AppError(400, "lensType must be sph, cyl, or compound");
  }
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const stock = await LensStock.findOne({ coating });
  if (!stock) throw new AppError(400, `${coating}: lens stock not found`);
  const price = getPriceForPower(stock, powerKey);
  const q = (stock.quantities as Record<string, Record<string, number>>) || {};
  const available = q[lensType]?.[powerKey] || 0;

  const existing = await ShopCartItem.findOne({ user: userId, coating, lensType, powerKey });
  if (existing) {
    const total = existing.quantity + qty;
    if (total > available) throw new AppError(400, `${coating} ${powerKey}: only ${available} in stock`);
    existing.quantity = total;
    existing.price = price;
    await existing.save();
    return { ...existing.toJSON(), available };
  }
  if (qty > available) throw new AppError(400, `${coating} ${powerKey}: only ${available} in stock`);
  const item = await ShopCartItem.create({ user: userId, coating, lensType, powerKey, quantity: qty, price });
  return { ...item.toJSON(), available };
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  if (quantity < 1) throw new AppError(400, "Quantity must be at least 1");
  const item = await ShopCartItem.findOne({ _id: itemId, user: userId });
  if (!item) throw new AppError(404, "Cart item not found");
  const stock = await LensStock.findOne({ coating: item.coating });
  if (!stock) throw new AppError(400, `${item.coating}: lens stock not found`);
  const q = (stock.quantities as Record<string, Record<string, number>>) || {};
  const available = q[item.lensType]?.[item.powerKey] || 0;
  if (quantity > available) throw new AppError(400, `${item.coating} ${item.powerKey}: only ${available} in stock`);
  item.quantity = quantity;
  await item.save();
  return { ...item.toJSON(), available };
}

export async function removeCartItem(userId: string, itemId: string) {
  const item = await ShopCartItem.findOne({ _id: itemId, user: userId });
  if (!item) throw new AppError(404, "Cart item not found");
  await item.deleteOne();
  return item.toJSON();
}

export async function clearCart(userId: string) {
  await ShopCartItem.deleteMany({ user: userId });
}

export async function withdrawCart(userId: string, username: string, note?: string) {
  const items = await ShopCartItem.find({ user: userId }).sort({ createdAt: 1 }).lean();
  if (items.length === 0) throw new AppError(400, "Cart is empty");

  const errors: string[] = [];
  const withdrawnItems: { coating: string; lensType: string; powerKey: string; quantity: number; price: number }[] = [];
  let totalQuantity = 0;
  let totalPrice = 0;

  for (const item of items) {
    const lensStock = await LensStock.findOne({ coating: item.coating });
    if (!lensStock) {
      errors.push(`${item.coating}: lens stock not found`);
      continue;
    }

    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    const current = q[item.lensType]?.[item.powerKey] || 0;
    const newQty = current - item.quantity;

    if (newQty < 0) {
      errors.push(`${item.coating} ${item.powerKey}: only ${current} available, need ${item.quantity}`);
      continue;
    }

    if (!q[item.lensType]) q[item.lensType] = {};
    q[item.lensType][item.powerKey] = newQty;

    lensStock.quantities = q;
    lensStock.markModified("quantities");
    await lensStock.save();

    const price = item.price ?? getPriceForPower(lensStock, item.powerKey);
    withdrawnItems.push({ coating: item.coating, lensType: item.lensType, powerKey: item.powerKey, quantity: item.quantity, price });
    totalQuantity += item.quantity;
    totalPrice += price * item.quantity;
  }

  if (withdrawnItems.length > 0) {
    await ShopLensWithdrawal.create({
      user: userId,
      username,
      items: withdrawnItems,
      totalQuantity,
      totalPrice,
      note: typeof note === "string" ? note : "",
    });
  }

  await ShopCartItem.deleteMany({ user: userId });

  return { withdrawn: withdrawnItems.length, errors };
}

export async function getWithdrawals(userId: string) {
  const withdrawals = await ShopLensWithdrawal.find({ user: userId }).sort({ withdrawnAt: -1 }).limit(100).lean();
  return attachAvailable(withdrawals);
}

export async function getWithdrawalById(userId: string, id: string) {
  const withdrawal = await ShopLensWithdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  return (await attachAvailable([withdrawal.toJSON()]))[0];
}

// Attaches the current in-stock quantity to each withdrawal item so the UI can
// cap edits at old qty + available (i.e. you can never push stock below zero).
async function attachAvailable(withdrawals: any[]) {
  const coatingCache = new Map<string, any>();
  const getStock = async (coating: string) => {
    if (!coatingCache.has(coating)) {
      coatingCache.set(coating, await LensStock.findOne({ coating }));
    }
    return coatingCache.get(coating);
  };
  for (const w of withdrawals) {
    for (const it of w.items || []) {
      const stock = await getStock(it.coating);
      const q = (stock?.quantities as Record<string, Record<string, number>>) || {};
      it.available = q[it.lensType]?.[it.powerKey] || 0;
    }
  }
  return withdrawals;
}

export async function deleteWithdrawal(userId: string, id: string) {
  const withdrawal = await ShopLensWithdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const coatingCache = new Map<string, any>();
  for (const it of withdrawal.items || []) {
    if (!it.coating || !it.lensType || !it.powerKey || it.quantity <= 0) continue;
    if (!coatingCache.has(it.coating)) {
      coatingCache.set(it.coating, await LensStock.findOne({ coating: it.coating }));
    }
    const lensStock = coatingCache.get(it.coating);
    if (!lensStock) continue;
    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    if (!q[it.lensType]) q[it.lensType] = {};
    q[it.lensType][it.powerKey] = (q[it.lensType][it.powerKey] || 0) + it.quantity;
    lensStock.quantities = q;
    lensStock.markModified("quantities");
    await lensStock.save();
  }

  await withdrawal.deleteOne();
  return withdrawal.toJSON();
}

export async function updateWithdrawal(
  userId: string,
  id: string,
  items: { coating: string; lensType: string; powerKey: string; quantity: number }[]
) {
  const withdrawal = await ShopLensWithdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const normalized: { coating: string; lensType: string; powerKey: string; quantity: number }[] = [];
  for (const it of items || []) {
    if (!it || !it.coating || !it.lensType || !it.powerKey) continue;
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (qty === 0) continue;
    normalized.push({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: qty });
  }

  if (normalized.length === 0) {
    return deleteWithdrawal(userId, id);
  }

  const oldMap = new Map<string, number>();
  for (const it of withdrawal.items || []) {
    const key = `${it.coating}|${it.lensType}|${it.powerKey}`;
    oldMap.set(key, (oldMap.get(key) || 0) + it.quantity);
  }
  const newMap = new Map<string, number>();
  for (const it of normalized) {
    const key = `${it.coating}|${it.lensType}|${it.powerKey}`;
    newMap.set(key, (newMap.get(key) || 0) + it.quantity);
  }

  // Positive delta = qty reduced/removed, so ADD stock back (lens returned to where it was taken).
  // Negative delta = qty increased/new line, so DEDUCT stock. Validate all deltas first,
  // then apply — avoids partial updates on validation failure.
  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const errors: string[] = [];
  const lensStockCache = new Map<string, any>();

  const getStock = async (coating: string) => {
    if (!lensStockCache.has(coating)) {
      lensStockCache.set(coating, await LensStock.findOne({ coating }));
    }
    return lensStockCache.get(coating);
  };

  const deltas: { stock: any; lensType: string; powerKey: string; delta: number }[] = [];
  for (const key of allKeys) {
    const [coating, lensType, powerKey] = key.split("|");
    const oldQty = oldMap.get(key) || 0;
    const newQty = newMap.get(key) || 0;
    const delta = oldQty - newQty;
    if (delta === 0) continue;
    const lensStock = await getStock(coating);
    if (!lensStock) {
      if (delta > 0) continue; // returning stock for a removed coating: nothing to add back
      errors.push(`${coating}: lens stock not found`);
      continue;
    }
    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    const current = q[lensType]?.[powerKey] || 0;
    if (current + delta < 0) {
      errors.push(`${coating} ${powerKey}: only ${current} available`);
      continue;
    }
    deltas.push({ stock: lensStock, lensType, powerKey, delta });
  }

  if (errors.length > 0) throw new AppError(400, errors.join("; "));

  for (const { stock, lensType, powerKey, delta } of deltas) {
    const q = (stock.quantities as Record<string, Record<string, number>>) || {};
    if (!q[lensType]) q[lensType] = {};
    q[lensType][powerKey] = (q[lensType][powerKey] || 0) + delta;
    stock.quantities = q;
    stock.markModified("quantities");
    await stock.save();
  }

  const mergedItems: { coating: string; lensType: string; powerKey: string; quantity: number; price: number }[] = [];
  for (const it of normalized) {
    const key = `${it.coating}|${it.lensType}|${it.powerKey}`;
    if (newMap.get(key) === undefined) continue;
    const qty = newMap.get(key)!;
    const lensStock = await getStock(it.coating);
    const price = getPriceForPower(lensStock, it.powerKey);
    mergedItems.push({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: qty, price });
    newMap.delete(key);
  }

  const totalQuantity = mergedItems.reduce((s, it) => s + it.quantity, 0);
  const totalPrice = mergedItems.reduce((s, it) => s + it.price * it.quantity, 0);

  withdrawal.items = mergedItems as typeof withdrawal.items;
  withdrawal.totalQuantity = totalQuantity;
  withdrawal.totalPrice = totalPrice;
  await withdrawal.save();

  return withdrawal.toJSON();
}
