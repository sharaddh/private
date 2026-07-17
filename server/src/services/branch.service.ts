import { Branch } from "../models/branch";
import { clearBranchCache } from "../models/db";
import { AppError } from "../middleware/errorHandler";

interface BranchData {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  dbName?: string;
  isActive?: boolean;
  settings?: Record<string, string>;
}

const UPDATE_WHITELIST = [
  "name",
  "code",
  "address",
  "phone",
  "email",
  "dbName",
  "isActive",
  "settings",
] as const;

export async function listActiveBranches() {
  return Branch.find({ isActive: true })
    .select("name code address phone email isActive")
    .sort({ name: 1 })
    .lean();
}

export async function listAllBranches() {
  return Branch.find().sort({ name: 1 }).lean();
}

export async function getBranchById(id: string) {
  const branch = await Branch.findById(id).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  return branch;
}

export async function createBranch(data: BranchData) {
  if (!data.name?.trim()) throw new AppError(400, "Branch name is required");
  if (!data.code?.trim()) throw new AppError(400, "Branch code is required");
  if (!data.dbName?.trim()) throw new AppError(400, "Database name is required");

  const existing = await Branch.findOne({ $or: [{ code: data.code }, { dbName: data.dbName }] }).lean();
  if (existing) {
    if (existing.code === data.code) throw new AppError(409, "Branch code already exists");
    if (existing.dbName === data.dbName) throw new AppError(409, "Database name already exists");
  }

  const branch = await Branch.create(data);
  clearBranchCache();
  return branch;
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  if (data.ownerName || data.ownerPhone || data.ownerEmail) {
    const settings = (data.settings as Record<string, string>) || {};
    if (data.ownerName) settings.shopName = data.ownerName as string;
    if (data.ownerPhone) settings.shopPhone = data.ownerPhone as string;
    if (data.ownerEmail) settings.shopEmail = data.ownerEmail as string;
    data.settings = settings;
  }
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = data[key];
    }
  }

  if (filtered.code) {
    const existing = await Branch.findOne({ code: filtered.code, _id: { $ne: id } }).lean();
    if (existing) throw new AppError(409, "Branch code already exists");
  }
  if (filtered.dbName) {
    const existing = await Branch.findOne({ dbName: filtered.dbName, _id: { $ne: id } }).lean();
    if (existing) throw new AppError(409, "Database name already exists");
  }

  const branch = await Branch.findByIdAndUpdate(id, { $set: filtered }, { new: true, runValidators: true }).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  return branch;
}

export async function deleteBranch(id: string) {
  const branch = await Branch.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  return branch;
}
