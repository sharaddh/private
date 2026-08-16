import { prisma } from "../db/prisma";
import { User } from "../models/user";
import { AppError } from "../middleware/errorHandler";
import { getPriceForPower } from "./lensStock.service";
import { istDateKey } from "../utils/date";

const CartItem = prisma.cartItem;
const LensStock = prisma.lensStock;
const Withdrawal = prisma.withdrawal;
const WithdrawalItem = prisma.withdrawalItem;

function getAvailableStock(stock: any, lensType: string, powerKey: string): number {
  const q = (stock?.quantities as Record<string, Record<string, number>>) || {};
  return q[lensType]?.[powerKey] || 0;
}

function pairStr(v: number): string {
  return `${Math.round((v / 2) * 2) / 2}p`;
}

function stockError(coating: string, powerKey: string, available: number): string {
  return `${coating} ${powerKey}: only ${pairStr(available)} in stock`;
}

export async function getCartItems(userId: string) {
  const items = await CartItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const coatingToStock = new Map<string, any>();
  for (const item of items) {
    if (!coatingToStock.has(item.coating)) {
      coatingToStock.set(item.coating, await LensStock.findFirst({ where: { coating: item.coating } }));
    }
  }
  return items.map((item) => ({
    ...item,
    available: getAvailableStock(coatingToStock.get(item.coating), item.lensType, item.powerKey),
  }));
}

export async function getCartCount(userId: string) {
  return CartItem.count({ where: { userId } });
}

export async function addToCart(
  userId: string,
  coating: string,
  lensType: string,
  powerKey: string,
  quantity: number = 1,
  fogMark: string = ""
) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const stock = await LensStock.findFirst({ where: { coating } });
  if (!stock) throw new AppError(400, `${coating}: lens stock not found`);
  const price = getPriceForPower(stock, powerKey);
  const available = getAvailableStock(stock, lensType, powerKey);
  const existing = await CartItem.findFirst({ where: { userId, coating, lensType, powerKey } });
  if (existing) {
    const total = existing.quantity + qty;
    if (total > available) throw new AppError(400, stockError(coating, powerKey, available));
    const data: { quantity: number; price: number; fogMark?: string } = { quantity: total, price };
    if (fogMark) data.fogMark = fogMark;
    const updated = await CartItem.update({ where: { id: existing.id }, data });
    return { ...updated, available };
  }
  if (qty > available) throw new AppError(400, stockError(coating, powerKey, available));
  const item = await CartItem.create({
    data: { userId, coating, lensType, powerKey, quantity: qty, price, fogMark },
  });
  return { ...item, available };
}

export async function updateCartItem(
  userId: string,
  itemId: string,
  quantity?: number,
  fogMark?: string
) {
  if (quantity !== undefined && quantity < 1)
    throw new AppError(400, "Quantity must be at least 1");
  const item = await CartItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError(404, "Cart item not found");
  const stock = await LensStock.findFirst({ where: { coating: item.coating } });
  if (!stock) throw new AppError(400, `${item.coating}: lens stock not found`);
  const available = getAvailableStock(stock, item.lensType, item.powerKey);
  if (quantity !== undefined) {
    if (quantity > available)
      throw new AppError(400, stockError(item.coating, item.powerKey, available));
  }
  const data: Record<string, any> = {};
  if (quantity !== undefined) data.quantity = Math.floor(quantity);
  if (typeof fogMark === "string") data.fogMark = fogMark;
  if (Object.keys(data).length > 0) {
    const updated = await CartItem.update({ where: { id: itemId }, data });
    return { ...updated, available };
  }
  return { ...item, available };
}

export async function removeCartItem(userId: string, itemId: string) {
  const item = await CartItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError(404, "Cart item not found");
  await CartItem.delete({ where: { id: itemId } });
  return item;
}

export async function clearCart(userId: string) {
  await CartItem.deleteMany({ where: { userId } });
}

export async function withdrawCart(userId: string, username: string) {
  const items = await CartItem.findMany({ where: { userId } });
  if (items.length === 0) throw new AppError(400, "Cart is empty");

  const errors: string[] = [];
  const withdrawnItems: {
    coating: string;
    lensType: string;
    powerKey: string;
    quantity: number;
    price: number;
    fogMark?: string;
  }[] = [];
  let totalQuantity = 0;
  let totalPrice = 0;

  for (const item of items) {
    const lensStock = await LensStock.findFirst({ where: { coating: item.coating } });
    if (!lensStock) {
      errors.push(`${item.coating}: lens stock not found`);
      continue;
    }

    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    const current = q[item.lensType]?.[item.powerKey] || 0;

    if (current <= 0) {
      errors.push(`${item.coating} ${item.powerKey}: no stock available`);
      continue;
    }
    if (item.quantity > current) {
      errors.push(`${item.coating} ${item.powerKey}: only ${pairStr(current)} in stock`);
      continue;
    }

    if (!q[item.lensType]) q[item.lensType] = {};
    q[item.lensType][item.powerKey] = current - item.quantity;

    await LensStock.update({ where: { id: lensStock.id }, data: { quantities: q } });

    const price = item.price ?? (lensStock.price as number) ?? 0;
    withdrawnItems.push({
      coating: item.coating,
      lensType: item.lensType,
      powerKey: item.powerKey,
      quantity: item.quantity,
      price,
      fogMark: item.fogMark || undefined,
    });
    totalQuantity += item.quantity;
    totalPrice += price * (item.quantity / 2);
  }

  if (withdrawnItems.length > 0) {
    await Withdrawal.create({
      data: {
        userId,
        username,
        totalQuantity,
        totalPrice,
        items: {
          create: withdrawnItems.map((it) => ({
            coating: it.coating,
            lensType: it.lensType,
            powerKey: it.powerKey,
            quantity: it.quantity,
            price: it.price,
            fogMark: it.fogMark || "",
          })),
        },
      },
    });
  }

  await CartItem.deleteMany({ where: { userId } });

  return { withdrawn: withdrawnItems.length, errors };
}

export async function getWithdrawals(userId: string) {
  const withdrawals = await Withdrawal.findMany({
    where: { userId },
    orderBy: { withdrawnAt: "desc" },
    include: { items: true },
  });
  return attachAvailable(withdrawals);
}

export async function getAllWithdrawals() {
  const withdrawals = await Withdrawal.findMany({
    orderBy: { withdrawnAt: "desc" },
    take: 200,
    include: { items: true },
  });
  return attachAvailable(withdrawals);
}

async function attachAvailable(withdrawals: any[]) {
  const coatingCache = new Map<string, any>();
  const getStock = async (coating: string) => {
    if (!coatingCache.has(coating)) {
      coatingCache.set(coating, await LensStock.findFirst({ where: { coating } }));
    }
    return coatingCache.get(coating);
  };
  for (const w of withdrawals) {
    for (const it of w.items || []) {
      it.available = getAvailableStock(await getStock(it.coating), it.lensType, it.powerKey);
    }
  }
  return withdrawals;
}

export async function deleteWithdrawal(userId: string, id: string) {
  const withdrawal = await Withdrawal.findFirst({ where: { id, userId }, include: { items: true } });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const coatingCache = new Map<string, any>();
  for (const it of withdrawal.items || []) {
    if (!it.coating || !it.lensType || !it.powerKey || it.quantity <= 0) continue;
    if (!coatingCache.has(it.coating)) {
      coatingCache.set(it.coating, await LensStock.findFirst({ where: { coating: it.coating } }));
    }
    const lensStock = coatingCache.get(it.coating);
    if (!lensStock) continue;
    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    if (!q[it.lensType]) q[it.lensType] = {};
    q[it.lensType][it.powerKey] = (q[it.lensType][it.powerKey] || 0) + it.quantity;
    await LensStock.update({ where: { id: lensStock.id }, data: { quantities: q } });
  }

  await WithdrawalItem.deleteMany({ where: { withdrawalId: id } });
  await Withdrawal.delete({ where: { id } });
  return withdrawal;
}

export async function markWithdrawalPaid(userId: string, id: string, paid: boolean = true) {
  const withdrawal = await Withdrawal.findFirst({ where: { id, userId } });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  const updated = await Withdrawal.update({
    where: { id },
    data: { paid: !!paid, paidAt: !!paid ? new Date() : null },
  });
  return updated;
}

export async function updateWithdrawal(
  userId: string,
  id: string,
  items: {
    coating: string;
    lensType: string;
    powerKey: string;
    quantity: number;
    fogMark?: string;
  }[]
) {
  const withdrawal = await Withdrawal.findFirst({ where: { id, userId }, include: { items: true } });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const normalized: {
    coating: string;
    lensType: string;
    powerKey: string;
    quantity: number;
    fogMark?: string;
  }[] = [];
  for (const it of items || []) {
    if (!it || !it.coating || !it.lensType || !it.powerKey) continue;
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (qty === 0) continue;
    normalized.push({
      coating: it.coating,
      lensType: it.lensType,
      powerKey: it.powerKey,
      quantity: qty,
      fogMark: it.fogMark || "",
    });
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

  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const errors: string[] = [];
  const lensStockCache = new Map<string, any>();

  const getStock = async (coating: string) => {
    if (!lensStockCache.has(coating)) {
      lensStockCache.set(coating, await LensStock.findFirst({ where: { coating } }));
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
      if (delta > 0) continue;
      errors.push(`${coating}: lens stock not found`);
      continue;
    }
    const q = (lensStock.quantities as Record<string, Record<string, number>>) || {};
    const current = q[lensType]?.[powerKey] || 0;
    if (current + delta < 0) {
      errors.push(`${coating} ${powerKey}: only ${pairStr(current)} available`);
      continue;
    }
    deltas.push({ stock: lensStock, lensType, powerKey, delta });
  }

  if (errors.length > 0) throw new AppError(400, errors.join("; "));

  for (const { stock, lensType, powerKey, delta } of deltas) {
    const q = (stock.quantities as Record<string, Record<string, number>>) || {};
    if (!q[lensType]) q[lensType] = {};
    q[lensType][powerKey] = (q[lensType][powerKey] || 0) + delta;
    await LensStock.update({ where: { id: stock.id }, data: { quantities: q } });
  }

  const mergedItems: {
    coating: string;
    lensType: string;
    powerKey: string;
    quantity: number;
    price: number;
    fogMark: string;
  }[] = [];
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
    mergedItems.push({
      coating: it.coating,
      lensType: it.lensType,
      powerKey: it.powerKey,
      quantity: qty,
      price,
      fogMark: fogByKey.get(key) || "",
    });
    newMap.delete(key);
  }

  const totalQuantity = mergedItems.reduce((s, it) => s + it.quantity, 0);
  const totalPrice = mergedItems.reduce((s, it) => s + it.price * (it.quantity / 2), 0);

  await WithdrawalItem.deleteMany({ where: { withdrawalId: id } });
  if (mergedItems.length > 0) {
    await WithdrawalItem.createMany({
      data: mergedItems.map((it) => ({
        withdrawalId: id,
        coating: it.coating,
        lensType: it.lensType,
        powerKey: it.powerKey,
        quantity: it.quantity,
        price: it.price,
        fogMark: it.fogMark,
      })),
    });
  }
  const updated = await Withdrawal.update({
    where: { id },
    data: { totalQuantity, totalPrice },
    include: { items: true },
  });

  return updated;
}

export async function sendWithdrawalPdf(userId: string, id: string, phone?: string) {
  const withdrawal = await Withdrawal.findFirst({ where: { id, userId }, include: { items: true } });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  const { generateWithdrawalPdf } = await import("../utils/pdf");
  const { whatsappManager } = await import("./whatsapp");
  const { normalizePhone, isValidWhatsAppPhone } = await import("../utils/phone");

  let targetPhone: string;
  if (phone) {
    targetPhone = phone;
  } else {
    const userDoc = await User.findUnique({ where: { id: withdrawal.userId }, select: { mobile: true } });
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
  const caption = `Lens list — ${withdrawal.username} · ${Math.round((withdrawal.totalQuantity / 2) * 2) / 2} pairs`;

  const wa = whatsappManager.getInstance();
  const result = await wa.sendMedia(target, base64, filename, "application/pdf", caption, true);

  if (!result.ok && result.error) {
    throw new AppError(500, result.error);
  }

  return { sent: true, phone: target, filename };
}
