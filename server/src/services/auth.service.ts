import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user";
import { Branch } from "../models/branch";
import { signAccess, signRefresh } from "../utils/jwt";
import { JWT_SECRET } from "../config";
import { AppError } from "../middleware/errorHandler";

interface RegisterData {
  username: string;
  password: string;
  name?: string;
  mobile?: string;
  role?: string;
  branchId?: string;
  branches?: string[];
}

interface LoginData {
  username: string;
  password: string;
  branchId?: string;
}

interface UpdateProfileData {
  name?: string;
  mobile?: string;
  password?: string;
}

interface UpdateUserData {
  name?: string;
  mobile?: string;
  branches?: string[];
  role?: string;
  password?: string;
}

interface RegisterWarehouseData {
  username: string;
  password: string;
  name?: string;
  mobile?: string;
}

interface FormattedUser {
  id: string;
  username: string;
  name: string;
  mobile: string;
  role: string;
  branches: Array<{
    _id: string;
    name: string;
    code: string;
    dbName: string;
    isActive: boolean;
    settings?: {
      shopName?: string;
      shopAddress?: string;
      shopPhone?: string;
      shopEmail?: string;
      adminWhatsApp?: string;
      logo?: string;
    };
  }>;
}

interface LoginResult {
  user: FormattedUser;
  access: string;
  refresh: string;
  branchId?: string;
}

interface LeanUser {
  _id: mongoose.Types.ObjectId;
  username: string;
  passwordHash: string;
  name: string;
  mobile: string;
  role: string;
  branches: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function formatUserWithBranches(user: any): Promise<FormattedUser> {
  const role = user.role as string;
  const branches = user.branches as mongoose.Types.ObjectId[] | undefined;

  let branchList: FormattedUser["branches"] = [];
  if (role === "owner") {
    branchList = await Branch.find({ isActive: true })
      .select("name code dbName isActive settings")
      .lean();
  } else if (branches && branches.length > 0) {
    branchList = await Branch.find({ _id: { $in: branches }, isActive: true })
      .select("name code dbName isActive settings")
      .lean();
  }

  return {
    id: String(user._id),
    username: user.username,
    name: user.name || "",
    mobile: user.mobile || "",
    role,
    branches: branchList.map((b) => ({
      _id: String(b._id),
      name: b.name,
      code: b.code,
      dbName: b.dbName,
      isActive: b.isActive,
      settings: b.settings,
    })),
  };
}

export async function registerUser(
  data: RegisterData,
  requestorRole: string
): Promise<FormattedUser> {
  if (requestorRole !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }

  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const existing = await User.findOne({ username: data.username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const allowedRoles = ["staff", "warehouse"];
  const finalRole = data.role && allowedRoles.includes(data.role) ? data.role : "staff";

  const userBranches =
    finalRole === "staff" && data.branchId ? [data.branchId] : data.branches || [];

  const user = await User.create({
    username: data.username,
    passwordHash,
    name: data.name || "",
    mobile: data.mobile || "",
    role: finalRole,
    branches: userBranches,
  });

  return formatUserWithBranches(user);
}

export async function loginUser(data: LoginData): Promise<LoginResult> {
  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username: data.username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  if (user.role === "staff") {
    throw new AppError(403, "Staff must use the staff login page");
  }

  const match = await bcrypt.compare(data.password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const formatted = await formatUserWithBranches(user);
  const branches = formatted.branches || [];
  const selectedBranchId =
    data.branchId || (branches.length > 0 ? branches[0]._id : undefined);

  const access = signAccess({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: String(user._id) });

  return {
    user: formatted,
    access,
    refresh,
    branchId: selectedBranchId,
  };
}

export async function staffLogin(data: LoginData): Promise<LoginResult> {
  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username: data.username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  if (user.role !== "staff") {
    throw new AppError(403, "Admins must use the admin login page");
  }

  const match = await bcrypt.compare(data.password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const formatted = await formatUserWithBranches(user);
  const staffBranches = formatted.branches || [];
  if (staffBranches.length === 0) {
    throw new AppError(403, "Your account has not been assigned to any branch. Contact admin.");
  }

  const branchId = staffBranches[0]._id;

  const access = signAccess({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: String(user._id) });

  return {
    user: formatted,
    access,
    refresh,
    branchId,
  };
}

export async function warehouseLogin(data: LoginData): Promise<LoginResult> {
  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username: data.username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  if (user.role !== "warehouse" && user.role !== "owner") {
    throw new AppError(403, "Access denied. Warehouse access requires a warehouse account.");
  }

  const match = await bcrypt.compare(data.password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const access = signAccess({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: String(user._id) });
  const formatted = await formatUserWithBranches(user);

  return {
    user: formatted,
    access,
    refresh,
  };
}

export async function registerWarehouseUser(
  data: RegisterWarehouseData,
  requestorRole: string
): Promise<FormattedUser> {
  if (requestorRole !== "owner" && requestorRole !== "warehouse") {
    throw new AppError(403, "Only admin or warehouse users can create warehouse accounts");
  }

  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const existing = await User.findOne({ username: data.username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    username: data.username,
    passwordHash,
    name: data.name || "",
    mobile: data.mobile || "",
    role: "warehouse",
  });

  return formatUserWithBranches(user);
}

export async function refreshToken(
  refreshTokenStr: string
): Promise<{ access: string }> {
  if (!refreshTokenStr) {
    throw new AppError(400, "Refresh token required");
  }

  const payload = jwt.verify(refreshTokenStr, JWT_SECRET) as { sub: string };
  const user = await User.findById(payload.sub).lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const access = signAccess({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });

  return { access };
}

export async function getProfile(userId: string): Promise<FormattedUser> {
  const user = await User.findById(userId).select("-passwordHash").lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return formatUserWithBranches(user);
}

export async function updateProfile(
  userId: string,
  data: UpdateProfileData
): Promise<FormattedUser> {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.mobile !== undefined) update.mobile = data.mobile;
  if (data.password?.trim()) {
    update.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
    .select("-passwordHash")
    .lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }

  return formatUserWithBranches(user);
}

export async function updateUser(
  userId: string,
  data: UpdateUserData,
  requestorRole: string
): Promise<FormattedUser> {
  if (requestorRole !== "owner" && requestorRole !== "warehouse") {
    throw new AppError(403, "Access denied");
  }

  const update: Record<string, unknown> = {};
  if (data.branches !== undefined) update.branches = data.branches;
  if (data.name !== undefined) update.name = data.name;
  if (data.mobile !== undefined) update.mobile = data.mobile;
  if (data.password?.trim()) {
    update.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
    .select("-passwordHash")
    .lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }

  return formatUserWithBranches(user);
}

export async function listUsers(
  requestorRole: string
): Promise<FormattedUser[]> {
  if (requestorRole !== "owner") {
    throw new AppError(403, "Only admin can list users");
  }

  const users = await User.find()
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .lean();

  return Promise.all(users.map((u) => formatUserWithBranches(u)));
}

export async function listWarehouseUsers(
  requestorRole: string
): Promise<Array<{ id: string; username: string; name: string; mobile: string; role: string; createdAt: Date }>> {
  if (requestorRole !== "owner" && requestorRole !== "warehouse") {
    throw new AppError(403, "Access denied");
  }

  const users = await User.find({ role: "warehouse" })
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .lean();

  return users.map((u) => ({
    id: String(u._id),
    username: u.username,
    name: u.name,
    mobile: u.mobile,
    role: u.role,
    createdAt: u.createdAt,
  }));
}

export async function deleteUser(
  targetId: string,
  requestorRole: string,
  requestorUserId: string
): Promise<void> {
  if (requestorRole !== "owner" && requestorRole !== "warehouse") {
    throw new AppError(403, "Access denied");
  }

  const target = await User.findById(targetId).lean();
  if (!target) {
    throw new AppError(404, "User not found");
  }

  if (target.role !== "warehouse" && requestorRole === "warehouse") {
    throw new AppError(403, "Warehouse users can only delete warehouse accounts");
  }

  if (target.role === "owner") {
    throw new AppError(400, "Cannot delete admin account");
  }

  if (String(target._id) === requestorUserId) {
    throw new AppError(400, "Cannot delete yourself");
  }

  await User.findByIdAndDelete(targetId);
}
