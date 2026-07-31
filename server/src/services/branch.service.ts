import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Branch } from "../models/branch";
import { User } from "../models/user";
import { clearBranchCache, getBranchModels } from "../models/db";
import { AppError } from "../middleware/errorHandler";

interface BranchData {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  dbName?: string;
  isActive?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerUsername?: string;
  ownerPassword?: string;
  logo?: string;
  settings?: Record<string, string>;
}

async function syncBranchShopSettings(branch: any) {
  try {
    const s = branch.settings || {};
    const models = getBranchModels(branch.dbName);
    await models.Settings.findOneAndUpdate(
      {},
      {
        $set: {
          shopName: s.shopName || branch.name || "",
          shopAddress: s.shopAddress || branch.address || "",
          shopPhone: s.shopPhone || branch.phone || "",
          shopEmail: s.shopEmail || branch.email || "",
          adminWhatsApp: s.ownerPhone || "",
          logo: s.logo || "",
        },
      },
      { upsert: true }
    );
  } catch (e: any) {
    console.warn("Could not sync branch shop settings", e?.message);
  }
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
  if (!data.ownerUsername?.trim()) throw new AppError(400, "Owner username is required");
  if (!data.ownerPassword?.trim()) throw new AppError(400, "Owner password is required");

  const existing = await Branch.findOne({ $or: [{ code: data.code }, { dbName: data.dbName }] }).lean();
  if (existing) {
    if (existing.code === data.code) throw new AppError(409, "Branch code already exists");
    if (existing.dbName === data.dbName) throw new AppError(409, "Database name already exists");
  }

  const existingUser = await User.findOne({ username: data.ownerUsername }).lean();
  if (existingUser) throw new AppError(409, "Owner username already exists");

  const branch = await Branch.create({
    name: data.name,
    code: data.code,
    dbName: data.dbName,
    address: data.address || "",
    phone: data.phone || "",
    email: data.email || "",
    settings: {
      shopName: data.name || "",
      shopAddress: data.address || "",
      shopPhone: data.phone || "",
      shopEmail: data.email || "",
      logo: data.logo || "",
      ownerName: data.ownerName || "",
      ownerPhone: data.ownerPhone || "",
      ownerEmail: data.ownerEmail || "",
    },
  });

  await syncBranchShopSettings(branch);

  const passwordHash = await bcrypt.hash(data.ownerPassword, 10);
  const newOwner = await User.create({
    username: data.ownerUsername,
    passwordHash,
    name: data.ownerName || "",
    mobile: data.ownerPhone || "",
    role: "owner",
    branches: [branch._id],
  });

  const otherBranchIds = (await Branch.find({ _id: { $ne: branch._id } }).select("_id").lean()).map((b) => b._id);
  if (otherBranchIds.length > 0) {
    await User.updateOne(
      { _id: newOwner._id },
      { $addToSet: { branches: { $each: otherBranchIds } } }
    );
  }

  await User.updateMany(
    { role: "owner", _id: { $ne: newOwner._id } },
    { $addToSet: { branches: branch._id } }
  );

  clearBranchCache();
  return branch;
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  if (data.ownerName || data.ownerPhone || data.ownerEmail || data.logo || data.name || data.address || data.phone || data.email) {
    const existing = await Branch.findById(id).select("settings").lean();
    const settings = { ...((existing?.settings as Record<string, string>) || {}) };
    if (data.name) settings.shopName = data.name as string;
    if (data.address) settings.shopAddress = data.address as string;
    if (data.phone) settings.shopPhone = data.phone as string;
    if (data.email) settings.shopEmail = data.email as string;
    if (data.ownerName) settings.ownerName = data.ownerName as string;
    if (data.ownerPhone) settings.ownerPhone = data.ownerPhone as string;
    if (data.ownerEmail) settings.ownerEmail = data.ownerEmail as string;
    if (data.logo) settings.logo = data.logo as string;
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

  await syncBranchShopSettings(branch);

  if (data.ownerUsername) {
    const existing = await User.findOne({ username: data.ownerUsername, branches: { $ne: new mongoose.Types.ObjectId(id) } }).lean();
    if (existing) throw new AppError(409, "Owner username already exists");
    await User.updateOne({ branches: new mongoose.Types.ObjectId(id), role: "owner" }, { $set: { username: data.ownerUsername } });
  }
  if (data.ownerPassword) {
    const hash = await bcrypt.hash(data.ownerPassword as string, 10);
    await User.updateOne({ branches: new mongoose.Types.ObjectId(id), role: "owner" }, { $set: { passwordHash: hash } });
  }

  clearBranchCache();
  return branch;
}

export async function deleteBranch(id: string) {
  const branch = await Branch.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  return branch;
}
