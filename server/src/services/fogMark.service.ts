import { Prisma, prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";

const FogMark = prisma.fogMark;

function toMongoDoc(row: any) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, _id: id };
}

function isNotFound(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export async function listFogMarks() {
  const marks = await FogMark.findMany({ orderBy: { name: "asc" } });
  return marks.map(toMongoDoc);
}

export async function getFogMark(id: string) {
  const mark = await FogMark.findUnique({ where: { id } });
  if (!mark) throw new AppError(404, "Fog mark not found");
  return toMongoDoc(mark);
}

export async function createFogMark(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "Name is required");
  const existing = await FogMark.findUnique({ where: { name: trimmed } });
  if (existing) throw new AppError(409, "Fog mark already exists");
  const mark = await FogMark.create({ data: { name: trimmed } });
  return toMongoDoc(mark);
}

export async function updateFogMark(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "Name is required");
  const existing = await FogMark.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Fog mark not found");
  const dup = await FogMark.findFirst({ where: { name: trimmed, NOT: { id } } });
  if (dup) throw new AppError(409, "Fog mark already exists");
  try {
    const mark = await FogMark.update({ where: { id }, data: { name: trimmed } });
    return toMongoDoc(mark);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Fog mark not found");
    throw err;
  }
}

export async function deleteFogMark(id: string) {
  try {
    const mark = await FogMark.delete({ where: { id } });
    return toMongoDoc(mark);
  } catch (err) {
    if (isNotFound(err)) throw new AppError(404, "Fog mark not found");
    throw err;
  }
}