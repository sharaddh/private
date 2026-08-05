import { getWarehouseModels } from "../models/db";
import { AppError } from "../middleware/errorHandler";
import { getPriceForPower } from "./lensStock.service";
import { istDateKey } from "../utils/date";

const { CartItem, LensStock, Withdrawal } = getWarehouseModels();

export async function getCartItems(userId: string) {
  return CartItem.find({ user: userId }).sort({ createdAt: 1 }).lean();
}

export async function getCartCount(userId: string) {
  return CartItem.countDocuments({ user: userId });
}

export async function addToCart(
  userId: string,
  coating: string,
  lensType: string,
  powerKey: string,
  quantity: number = 1,
  fogMark: string = ""
) {
  const stock = await LensStock.findOne({ coating });
  const price = getPriceForPower(stock, powerKey);
  const existing = await CartItem.findOne({ user: userId, coating, lensType, powerKey });
  if (existing) {
    existing.quantity += quantity;
    existing.price = price;
    if (fogMark) existing.fogMark = fogMark;
    await existing.save();
    return existing.toJSON();
  }
  const item = new CartItem({ user: userId, coating, lensType, powerKey, quantity, price, fogMark });
  await item.save();
  return item.toJSON();
}

export async function updateCartItem(userId: string, itemId: string, quantity: number, fogMark?: string) {
  if (quantity < 1) throw new AppError(400, "Quantity must be at least 1");
  const item = await CartItem.findOne({ _id: itemId, user: userId });
  if (!item) throw new AppError(404, "Cart item not found");
  item.quantity = quantity;
  if (typeof fogMark === "string") item.fogMark = fogMark;
  await item.save();
  return item.toJSON();
}

export async function removeCartItem(userId: string, itemId: string) {
  const item = await CartItem.findOne({ _id: itemId, user: userId });
  if (!item) throw new AppError(404, "Cart item not found");
  await item.deleteOne();
  return item.toJSON();
}

export async function clearCart(userId: string) {
  await CartItem.deleteMany({ user: userId });
}

export async function withdrawCart(userId: string, username: string) {
  const items = await CartItem.find({ user: userId }).lean();
  if (items.length === 0) throw new AppError(400, "Cart is empty");

  const errors: string[] = [];
  const withdrawnItems: { coating: string; lensType: string; powerKey: string; quantity: number; price: number; fogMark?: string }[] = [];
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
    const newQty = Math.max(0, current - item.quantity);

    if (newQty === 0 && current === 0) {
      errors.push(`${item.coating} ${item.powerKey}: no stock available`);
      continue;
    }

    if (!q[item.lensType]) q[item.lensType] = {};
    q[item.lensType][item.powerKey] = newQty;

    lensStock.quantities = q;
    lensStock.markModified("quantities");
    await lensStock.save();

    const price = item.price ?? (lensStock.price as number) ?? 0;
    withdrawnItems.push({ coating: item.coating, lensType: item.lensType, powerKey: item.powerKey, quantity: item.quantity, price, fogMark: item.fogMark || undefined });
    totalQuantity += item.quantity;
    totalPrice += price * item.quantity;
  }

  if (withdrawnItems.length > 0) {
    await Withdrawal.create({
      user: userId,
      username,
      items: withdrawnItems,
      totalQuantity,
      totalPrice,
    });
  }

  await CartItem.deleteMany({ user: userId });

  return { withdrawn: withdrawnItems.length, errors };
}

export async function getWithdrawals(userId: string) {
  return Withdrawal.find({ user: userId }).sort({ withdrawnAt: -1 }).lean();
}

export async function getAllWithdrawals() {
  return Withdrawal.find({}).sort({ withdrawnAt: -1 }).limit(200).lean();
}

export async function markWithdrawalPaid(userId: string, id: string, paid: boolean = true) {
  const withdrawal = await Withdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  withdrawal.paid = !!paid;
  withdrawal.paidAt = withdrawal.paid ? new Date() : undefined;
  await withdrawal.save();
  return withdrawal.toJSON();
}

export async function updateWithdrawal(
  userId: string,
  id: string,
  items: { coating: string; lensType: string; powerKey: string; quantity: number; fogMark?: string }[]
) {
  const withdrawal = await Withdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const normalized: { coating: string; lensType: string; powerKey: string; quantity: number; fogMark?: string }[] = [];
  for (const it of items || []) {
    if (!it || !it.coating || !it.lensType || !it.powerKey) continue;
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (qty === 0) continue;
    normalized.push({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: qty, fogMark: it.fogMark || "" });
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

  // Determine stock deltas. Positive delta = we need to ADD stock back (qty reduced/removed).
  // Negative delta = we need to DEDUCT stock (qty increased or new line added).
  // Validate all deltas first, then apply — avoids partial updates on validation failure.
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

  const mergedItems: { coating: string; lensType: string; powerKey: string; quantity: number; price: number; fogMark: string }[] = [];
  const fogByKey = new Map<string, string>();
  for (const it of normalized) {
    const key = `${it.coating}|${it.lensType}|${it.powerKey}`;
    if (!fogByKey.has(key)) fogByKey.set(key, it.fogMark || "");
  }
  for (const it of normalized) {
    const key = `${it.coating}|${it.lensType}|${it.powerKey}`;
    if (newMap.get(key) === undefined) continue;
    const qty = newMap.get(key)!;
    const lensStock = await getStock(it.coating);
    const price = getPriceForPower(lensStock, it.powerKey);
    mergedItems.push({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: qty, price, fogMark: fogByKey.get(key) || "" });
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

export async function sendWithdrawalPdf(userId: string, id: string, phone?: string) {
  const withdrawal = await Withdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const { generateWithdrawalPdf } = await import("../utils/pdf");
  const { whatsappManager } = await import("./whatsapp");
  const { normalizePhone, isValidWhatsAppPhone } = await import("../utils/phone");
  const { User } = await import("../models/user");

  let targetPhone = "";
  if (phone) {
    targetPhone = phone;
  } else {
    const userDoc = await User.findById(withdrawal.user).select("mobile").lean();
    targetPhone = userDoc?.mobile || "";
  }
  const target = normalizePhone(targetPhone);
  if (!target || !isValidWhatsAppPhone(target)) {
    throw new AppError(400, "No valid WhatsApp number available for this withdrawal");
  }

  const pdfBuffer = generateWithdrawalPdf({
    username: withdrawal.username,
    withdrawnAt: withdrawal.withdrawnAt,
    items: withdrawal.items,
    totalQuantity: withdrawal.totalQuantity,
    totalPrice: withdrawal.totalPrice,
  });

  const base64 = pdfBuffer.toString("base64");
  const filename = `Lens_List_${istDateKey(withdrawal.withdrawnAt)}.pdf`;
  const caption = `Lens list — ${withdrawal.username} · ${withdrawal.totalQuantity} items`;

  const wa = whatsappManager.getInstance();
  const result = await wa.sendMedia(target, base64, filename, "application/pdf", caption, true);

  if (!result.ok && result.error) {
    throw new AppError(500, result.error);
  }

  return { sent: true, phone: target, filename };
}
