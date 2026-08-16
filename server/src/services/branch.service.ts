import bcrypt from "bcrypt";
import { prisma } from "../db/prisma";
import { Branch } from "../models/branch";
import { User } from "../models/user";
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
    const s = (branch.settings || {}) as Record<string, string>;
    await prisma.settings.upsert({
      where: { branchId: branch.id },
      create: {
        branchId: branch.id,
        shopName: s.shopName || branch.name || "",
        shopAddress: s.shopAddress || branch.address || "",
        shopPhone: s.shopPhone || branch.phone || "",
        shopEmail: s.shopEmail || branch.email || "",
        adminWhatsApp: s.ownerPhone || "",
        logo: s.logo || "",
      },
      update: {
        shopName: s.shopName || branch.name || "",
        shopAddress: s.shopAddress || branch.address || "",
        shopPhone: s.shopPhone || branch.phone || "",
        shopEmail: s.shopEmail || branch.email || "",
        adminWhatsApp: s.ownerPhone || "",
        logo: s.logo || "",
      },
    });
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
  return Branch.findMany({
    where: { isActive: true },
    select: { name: true, code: true, address: true, phone: true, email: true, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listAllBranches() {
  return Branch.findMany({ orderBy: { name: "asc" } });
}

export async function getBranchById(id: string) {
  const branch = await Branch.findUnique({ where: { id } });
  if (!branch) throw new AppError(404, "Branch not found");
  return branch;
}

export async function createBranch(data: BranchData) {
  if (!data.name?.trim()) throw new AppError(400, "Branch name is required");
  if (!data.code?.trim()) throw new AppError(400, "Branch code is required");
  if (!data.dbName?.trim()) throw new AppError(400, "Database name is required");
  if (!data.ownerUsername?.trim()) throw new AppError(400, "Owner username is required");
  if (!data.ownerPassword?.trim()) throw new AppError(400, "Owner password is required");

  const existing = await Branch.findFirst({
    where: { OR: [{ code: data.code }, { dbName: data.dbName }] },
  });
  if (existing) {
    if (existing.code === data.code) throw new AppError(409, "Branch code already exists");
    if (existing.dbName === data.dbName) throw new AppError(409, "Database name already exists");
  }

  const existingUser = await User.findFirst({ where: { username: data.ownerUsername } });
  if (existingUser) throw new AppError(409, "Owner username already exists");

  const branch = await Branch.create({
    data: {
      name: data.name!,
      code: data.code!,
      dbName: data.dbName!,
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
    },
  });

  await syncBranchShopSettings(branch);

  const passwordHash = await bcrypt.hash(data.ownerPassword, 10);
  const newOwner = await User.create({
    data: {
      username: data.ownerUsername,
      passwordHash,
      name: data.ownerName || "",
      mobile: data.ownerPhone || "",
      role: "owner",
      branches: { connect: [{ id: branch.id }] },
    },
  });

  const otherBranchIds = (
    await Branch.findMany({ where: { id: { not: branch.id } }, select: { id: true } })
  ).map((b) => b.id);
  if (otherBranchIds.length > 0) {
    await User.update({
      where: { id: newOwner.id },
      data: { branches: { connect: otherBranchIds.map((id) => ({ id })) } },
    });
  }

  const otherOwners = await prisma.user.findMany({ where: { role: "owner", id: { not: newOwner.id } } });
  for (const owner of otherOwners) {
    await prisma.user.update({ where: { id: owner.id }, data: { branches: { connect: { id: branch.id } } } });
  }

  clearBranchCache();
  return branch;
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  if (
    data.ownerName ||
    data.ownerPhone ||
    data.ownerEmail ||
    data.logo ||
    data.name ||
    data.address ||
    data.phone ||
    data.email
  ) {
    const existing = await Branch.findUnique({ where: { id }, select: { settings: true } });
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
    const existing = await Branch.findFirst({ where: { code: filtered.code as string, id: { not: id } } });
    if (existing) throw new AppError(409, "Branch code already exists");
  }
  if (filtered.dbName) {
    const existing = await Branch.findFirst({ where: { dbName: filtered.dbName as string, id: { not: id } } });
    if (existing) throw new AppError(409, "Database name already exists");
  }

  const branch = await Branch.update({ where: { id }, data: filtered as any });
  if (!branch) throw new AppError(404, "Branch not found");

  await syncBranchShopSettings(branch);

  if (data.ownerUsername) {
    const branchOwner = await User.findFirst({
      where: { role: "owner", branches: { some: { id } } },
      select: { id: true },
    });
    if (branchOwner) {
      const existing = await User.findFirst({
        where: { username: data.ownerUsername as string, id: { not: branchOwner.id } },
      });
      if (existing) throw new AppError(409, "Owner username already exists");
      await User.update({ where: { id: branchOwner.id }, data: { username: data.ownerUsername as string } });
    }
  }
  if (data.ownerPassword) {
    const branchOwner = await User.findFirst({
      where: { role: "owner", branches: { some: { id } } },
      select: { id: true },
    });
    if (branchOwner) {
      const hash = await bcrypt.hash(data.ownerPassword as string, 10);
      await User.update({ where: { id: branchOwner.id }, data: { passwordHash: hash } });
    }
  }

  clearBranchCache();
  return branch;
}

export async function deleteBranch(id: string) {
  const branch = await Branch.update({ where: { id }, data: { isActive: false } });
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  return branch;
}
