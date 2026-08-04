import { getWarehouseModels } from "../models/db";
import { AppError } from "../middleware/errorHandler";

const { LensStock } = getWarehouseModels();

export async function listLensStock() {
  return LensStock.find().sort({ coating: 1 }).lean();
}

export async function getLensStockById(id: string) {
  const item = await LensStock.findById(id).lean();
  if (!item) throw new AppError(404, "Lens stock not found");
  return item;
}

export async function createLensStock(coating: string, price: number = 0, priceNeg?: number, pricePos?: number) {
  const existing = await LensStock.findOne({ coating });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  return LensStock.create({
    coating,
    price,
    priceNeg: priceNeg ?? price,
    pricePos: pricePos ?? price,
    quantities: { sph: {}, cyl: {}, compound: {} },
  });
}

export async function renameLensStock(id: string, coating: string, price?: number, priceNeg?: number, pricePos?: number) {
  const existing = await LensStock.findOne({ coating, _id: { $ne: id } });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  const update: Record<string, unknown> = { coating };
  if (price !== undefined) update.price = price;
  if (priceNeg !== undefined) update.priceNeg = priceNeg;
  if (pricePos !== undefined) update.pricePos = pricePos;
  const item = await LensStock.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
  if (!item) throw new AppError(404, "Lens stock not found");
  return item;
}

export async function deleteLensStock(id: string) {
  const item = await LensStock.findByIdAndDelete(id).lean();
  if (!item) throw new AppError(404, "Lens stock not found");
  return item;
}

export async function updateQuantity(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  powerKey: string,
  quantity: number
) {
  const item = await LensStock.findById(id);
  if (!item) throw new AppError(404, "Lens stock not found");

  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};
  q[lensType][powerKey] = Math.max(0, quantity);

  item.quantities = q;
  item.markModified("quantities");
  await item.save();
  return item.toObject();
}

export async function bulkUpdateQuantities(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  updates: Record<string, number>
) {
  const item = await LensStock.findById(id);
  if (!item) throw new AppError(404, "Lens stock not found");

  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};

  for (const [key, qty] of Object.entries(updates)) {
    q[lensType][key] = Math.max(0, qty);
  }

  item.quantities = q;
  item.markModified("quantities");
  await item.save();
  return item.toObject();
}
