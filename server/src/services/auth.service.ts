import bcrypt from "bcrypt";
import { User } from "../models/user";
import { Branch } from "../models/branch";
import { signAccess, signRefresh, verifyToken } from "../utils/jwt";
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

interface RegisterOwnerData {
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
    id: string;
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
      ownerName?: string;
      ownerPhone?: string;
      ownerEmail?: string;
    };
  }>;
}

interface LoginResult {
  user: FormattedUser;
  access: string;
  refresh: string;
  branchId?: string;
}

async function formatUserWithBranches(user: any): Promise<FormattedUser> {
  const role = user.role as string;

  let branchList: FormattedUser["branches"] = [];

  if (user.branches && Array.isArray(user.branches) && user.branches.length > 0) {
    const branches = user.branches as any[];
    if (typeof branches[0] === "object" && branches[0] !== null) {
      branchList = branches
        .filter((b) => b.isActive)
        .map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          dbName: b.dbName,
          isActive: b.isActive,
          settings: b.settings,
        }));
    } else {
      const branchIds = branches.map((b: any) => (typeof b === "string" ? b : String(b)));
      const docs = await Branch.findMany({
        where: { id: { in: branchIds }, isActive: true },
        select: { id: true, name: true, code: true, dbName: true, isActive: true, settings: true },
      });

      const docMap = new Map(docs.map((b) => [b.id, b]));
      branchList = branchIds
        .map((id) => docMap.get(id))
        .filter((b): b is NonNullable<(typeof docs)[number]> => Boolean(b))
        .map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          dbName: b.dbName,
          isActive: b.isActive,
          settings: b.settings as any,
        }));
    }
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name || "",
    mobile: user.mobile || "",
    role,
    branches: branchList,
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

  const existing = await User.findFirst({ where: { username: data.username } });
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const allowedRoles = ["staff", "warehouse"];
  const finalRole = data.role && allowedRoles.includes(data.role) ? data.role : "staff";

  const userBranches =
    finalRole === "staff" && data.branchId ? [data.branchId] : data.branches || [];

  const user = await User.create({
    data: {
      username: data.username,
      passwordHash,
      name: data.name || "",
      mobile: data.mobile || "",
      role: finalRole,
      branches: userBranches.length > 0 ? { connect: userBranches.map((id) => ({ id })) } : undefined,
    },
    include: { branches: true },
  });

  return formatUserWithBranches(user);
}

export async function loginUser(data: LoginData): Promise<LoginResult> {
  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findFirst({
    where: { username: data.username },
    include: { branches: true },
  });
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
  const userBranches = formatted.branches || [];
  const selectedBranchId = userBranches[0]?.id;

  const access = signAccess({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: user.id });

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

  const user = await User.findFirst({
    where: { username: data.username },
    include: { branches: true },
  });
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

  const branchId = staffBranches[0].id;

  const access = signAccess({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: user.id });

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

  const user = await User.findFirst({
    where: { username: data.username },
    include: { branches: true },
  });
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  if (user.role !== "owner") {
    throw new AppError(403, "Access denied. Only owners can access the warehouse.");
  }

  const match = await bcrypt.compare(data.password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const access = signAccess({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  const refresh = signRefresh({ sub: user.id });
  const formatted = await formatUserWithBranches(user);

  return {
    user: formatted,
    access,
    refresh,
  };
}

export async function registerOwner(
  data: RegisterOwnerData,
  requestorRole: string
): Promise<FormattedUser> {
  if (!data.username?.trim() || !data.password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const existing = await User.findFirst({ where: { username: data.username } });
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const ownerCount = await User.count({ where: { role: "owner" } });
  if (ownerCount > 0 && requestorRole !== "owner") {
    throw new AppError(403, "Only owners can create new owners");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    data: {
      username: data.username,
      passwordHash,
      name: data.name || "",
      mobile: data.mobile || "",
      role: "owner",
    },
    include: { branches: true },
  });

  return formatUserWithBranches(user);
}

export async function refreshToken(refreshTokenStr: string): Promise<{ access: string }> {
  if (!refreshTokenStr) {
    throw new AppError(400, "Refresh token required");
  }

  const payload = verifyToken<{ sub: string }>(refreshTokenStr);
  const user = await User.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const access = signAccess({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return { access };
}

export async function getProfile(userId: string): Promise<FormattedUser> {
  const user = await User.findUnique({
    where: { id: userId },
    include: { branches: true },
  });
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

  let user;
  try {
    user = await User.update({
      where: { id: userId },
      data: update as any,
      include: { branches: true },
    });
  } catch {
    user = null;
  }
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
  if (requestorRole !== "owner") {
    throw new AppError(403, "Access denied");
  }

  const updateData: Record<string, unknown> = {};
  if (data.branches !== undefined) {
    updateData.branches = { set: data.branches.map((id) => ({ id })) };
  }
  if (data.name !== undefined) updateData.name = data.name;
  if (data.mobile !== undefined) updateData.mobile = data.mobile;
  if (data.password?.trim()) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  let user;
  try {
    user = await User.update({
      where: { id: userId },
      data: updateData as any,
      include: { branches: true },
    });
  } catch {
    user = null;
  }
  if (!user) {
    throw new AppError(404, "User not found");
  }

  return formatUserWithBranches(user);
}

export async function listUsers(requestorRole: string): Promise<FormattedUser[]> {
  if (requestorRole !== "owner") {
    throw new AppError(403, "Only admin can list users");
  }

  const users = await User.findMany({
    orderBy: { createdAt: "desc" },
    include: { branches: true },
  });

  return Promise.all(users.map((u) => formatUserWithBranches(u)));
}

export async function listWarehouseUsers(requestorRole: string): Promise<
  Array<{
    id: string;
    username: string;
    name: string;
    mobile: string;
    role: string;
    createdAt: Date;
  }>
> {
  if (requestorRole !== "owner") {
    throw new AppError(403, "Access denied");
  }

  const users = await User.findMany({
    where: { role: "owner" },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
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
  if (requestorRole !== "owner") {
    throw new AppError(403, "Access denied");
  }

  const target = await User.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError(404, "User not found");
  }

  if (target.role === "owner") {
    throw new AppError(400, "Owner accounts cannot be deleted");
  }

  if (target.id === requestorUserId) {
    throw new AppError(400, "Cannot delete yourself");
  }

  await User.delete({ where: { id: targetId } });
}
