import { Prisma, prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";

const LensStock = prisma.warehouseLensStock;

function toMongoDoc(row: any) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, _id: id };
}

function isNotFound(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export async function listLensStock() {
  const items = await LensStock.findMany({ orderBy: { coating: "asc" } });
  return items.map(toMongoDoc);
}

export async function getLensStockById(id: string) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");
  return toMongoDoc(item);
}

export async function createLensStock(
  coating: string,
  price: number = 0,
  priceNeg?: number,
  pricePos?: number
) {
  const existing = await LensStock.findUnique({ where: { coating } });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  const item = await LensStock.create({
    data: {
      coating,
      price,
      priceNeg: priceNeg ?? price,
      pricePos: pricePos ?? price,
      quantities: { sph: {}, cyl: {}, compound: {} },
    },
  });
  return toMongoDoc(item);
}

export async function renameLensStock(
  id: string,
  coating: string,
  price?: number,
  priceNeg?: number,
  pricePos?: number
) {
  const existing = await LensStock.findFirst({ where: { coating, NOT: { id } } });
  if (existing) throw new AppError(409, `Coating "${coating}" already exists`);
  const update: Record<string, unknown> = { coating };
  if (price !== undefined) update.price = price;
  if (priceNeg !== undefined) update.priceNeg = priceNeg;
  if (pricePos !== undefined) update.pricePos = pricePos;
  try {
    const item = await LensStock.update({
      where: { id },
      data: update as Prisma.WarehouseLensStockUpdateInput,
    });
    return toMongoDoc(item);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Lens stock not found");
    throw err;
  }
}

export async function deleteLensStock(id: string) {
  try {
    const item = await LensStock.delete({ where: { id } });
    return toMongoDoc(item);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Lens stock not found");
    throw err;
  }
}

export async function updateQuantity(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  powerKey: string,
  quantity: number
) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");

  const q: Record<string, Record<string, number>> =
    (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};
  q[lensType][powerKey] = Math.max(0, Math.floor(quantity));

  try {
    const updated = await LensStock.update({ where: { id }, data: { quantities: q } });
    return toMongoDoc(updated);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Lens stock not found");
    throw err;
  }
}

export async function bulkUpdateQuantities(
  id: string,
  lensType: "sph" | "cyl" | "compound",
  updates: Record<string, number>
) {
  const item = await LensStock.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Lens stock not found");

  const q: Record<string, Record<string, number>> =
    (item.quantities as Record<string, Record<string, number>>) || {};
  if (!q[lensType]) q[lensType] = {};

  for (const [key, qty] of Object.entries(updates)) {
    q[lensType][key] = Math.max(0, Math.floor(qty));
  }

  try {
    const updated = await LensStock.update({ where: { id }, data: { quantities: q } });
    return toMongoDoc(updated);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Lens stock not found");
    throw err;
  }
}