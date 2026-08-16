import { LensStock } from "../models/lensStock";
import { AppError } from "../middleware/errorHandler";
import { requireBranchId } from "../utils/scope";

export function getPriceForPower(
  item: { price?: number; priceNeg?: number; pricePos?: number } | null | undefined,
  powerKey: string
): number {
  if (!item) return 0;
  const sph = String(powerKey || "").split("|")[0];
  const isNeg = sph.startsWith("-") && sph !== "-0.00";
  if (isNeg) return item.priceNeg ?? item.price ?? 0;
  return item.pricePos ?? item.price ?? 0;
}

export async function listLensStock() {
  return LensStock.findMany({ orderBy: { coating: "asc" } });
}

export async function getLensStockById(id: string) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");
  return item;
}

export async function createLensStock(
  coating: string,
  price: number = 0,
  priceNeg?: number,
  pricePos?: number
) {
  const existing = await LensStock.findFirst({ where: { coating } });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  return LensStock.create({
    data: {
      coating,
      price,
      priceNeg: priceNeg ?? price,
      pricePos: pricePos ?? price,
      quantities: { sph: {}, cyl: {}, compound: {} },
      branchId: requireBranchId(),
    },
  });
}

export async function renameLensStock(
  id: string,
  coating: string,
  price?: number,
  priceNeg?: number,
  pricePos?: number
) {
  const existing = await LensStock.findFirst({
    where: { coating, id: { not: id } },
  });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  const update: Record<string, unknown> = { coating };
  if (price !== undefined) update.price = price;
  if (priceNeg !== undefined) update.priceNeg = priceNeg;
  if (pricePos !== undefined) update.pricePos = pricePos;
  const item = await LensStock.update({ where: { id }, data: update });
  if (!item) throw new AppError(404, "Lens stock not found");
  return item;
}

export async function deleteLensStock(id: string) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");
  await LensStock.delete({ where: { id } });
  return item;
}

export async function updateQuantity(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  powerKey: string,
  quantity: number
) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");

  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};
  q[lensType][powerKey] = Math.max(0, Math.floor(quantity));

  await LensStock.update({ where: { id }, data: { quantities: q } });
  return LensStock.findUnique({ where: { id } });
}

export async function bulkUpdateQuantities(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  updates: Record<string, number>
) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");

  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};

  for (const [key, qty] of Object.entries(updates)) {
    q[lensType][key] = Math.max(0, Math.floor(qty));
  }

  await LensStock.update({ where: { id }, data: { quantities: q } });
  return LensStock.findUnique({ where: { id } });
}
