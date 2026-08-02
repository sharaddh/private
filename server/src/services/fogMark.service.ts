import { getWarehouseModels } from "../models/db";
import { AppError } from "../middleware/errorHandler";

const { FogMark } = getWarehouseModels();

export async function listFogMarks() {
  return FogMark.find().sort({ name: 1 }).lean();
}

export async function getFogMark(id: string) {
  const mark = await FogMark.findById(id).lean();
  if (!mark) throw new AppError(404, "Fog mark not found");
  return mark;
}

export async function createFogMark(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "Name is required");
  const existing = await FogMark.findOne({ name: trimmed });
  if (existing) throw new AppError(409, "Fog mark already exists");
  const mark = await FogMark.create({ name: trimmed });
  return mark.toJSON();
}

export async function updateFogMark(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "Name is required");
  const existing = await FogMark.findOne({ _id: id });
  if (!existing) throw new AppError(404, "Fog mark not found");
  const dup = await FogMark.findOne({ name: trimmed, _id: { $ne: id } });
  if (dup) throw new AppError(409, "Fog mark already exists");
  existing.name = trimmed;
  await existing.save();
  return existing.toJSON();
}

export async function deleteFogMark(id: string) {
  const mark = await FogMark.findByIdAndDelete(id);
  if (!mark) throw new AppError(404, "Fog mark not found");
  return mark.toJSON();
}
