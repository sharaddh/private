import { getWarehouseModels } from "../models/db";
import { AppError } from "../middleware/errorHandler";

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
  quantity: number = 1
) {
  const stock = await LensStock.findOne({ coating });
  const price = stock?.price || 0;
  const existing = await CartItem.findOne({ user: userId, coating, lensType, powerKey });
  if (existing) {
    existing.quantity += quantity;
    existing.price = price;
    await existing.save();
    return existing.toJSON();
  }
  const item = new CartItem({ user: userId, coating, lensType, powerKey, quantity, price });
  await item.save();
  return item.toJSON();
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  if (quantity < 1) throw new AppError(400, "Quantity must be at least 1");
  const item = await CartItem.findOne({ _id: itemId, user: userId });
  if (!item) throw new AppError(404, "Cart item not found");
  item.quantity = quantity;
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
    withdrawnItems.push({ coating: item.coating, lensType: item.lensType, powerKey: item.powerKey, quantity: item.quantity, price });
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

export async function markWithdrawalPaid(userId: string, id: string) {
  const withdrawal = await Withdrawal.findOne({ _id: id, user: userId });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  if (!withdrawal.paid) {
    withdrawal.paid = true;
    withdrawal.paidAt = new Date();
    await withdrawal.save();
  }
  return withdrawal.toJSON();
}
