import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { Branch } from "../models/branch";
import { signAccess, signRefresh } from "../utils/jwt";
import { JWT_SECRET } from "../config";
import { AppError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";

async function formatUserWithBranches(user: any) {
  let branchList: any[] = [];
  if (user.role === "owner") {
    // Owner always sees all active branches
    branchList = await Branch.find({ isActive: true }).select("name code dbName isActive").lean();
  } else if (user.branches && user.branches.length > 0) {
    branchList = await Branch.find({ _id: { $in: user.branches }, isActive: true }).select("name code dbName isActive").lean();
  }
  // Staff/warehouse without assigned branches get empty list
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    branches: branchList,
  };
}

export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const allowedRoles = ["staff", "warehouse"];
  const finalRole = allowedRoles.includes(role) ? role : "owner";
  // Staff users are auto-assigned to the selected branch
  const userBranches = finalRole === "staff" && branchId ? [branchId] : (req.body.branches || []);
  const user = await User.create({ username, passwordHash, name: name || "", mobile: mobile || "", role: finalRole, branches: userBranches });
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}

export async function warehouseLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }
  if (user.role !== "warehouse" && user.role !== "owner") {
    throw new AppError(403, "Access denied. Warehouse access requires a warehouse account.");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }
  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });
  const formatted = await formatUserWithBranches(user);
  return res.json({ success: true, data: { user: formatted, access, refresh } });
}

export async function warehouseRegister(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Only admin or warehouse users can create warehouse accounts");
  }
  const { username, password, name, mobile } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, name: name || "", mobile: mobile || "", role: "warehouse" });
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}

export async function login(req: Request, res: Response) {
  const { username, password, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }
  if (user.role === "staff") {
    throw new AppError(403, "Staff must use the staff login page");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }
  const formatted = await formatUserWithBranches(user);
  // Auto-select branch: use provided branchId, or first available branch
  const branches = formatted.branches || [];
  const selectedBranchId = branchId || (branches.length > 0 ? branches[0]._id?.toString() : null);
  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });
  return res.json({ success: true, data: { user: formatted, access, refresh, branchId: selectedBranchId } });
}

export async function staffLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }
  if (user.role !== "staff") {
    throw new AppError(403, "Admins must use the admin login page");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }
  const formatted = await formatUserWithBranches(user);

  // Auto-detect branch from staff's assigned branches
  const staffBranches = formatted.branches || [];
  if (staffBranches.length === 0) {
    throw new AppError(403, "Your account has not been assigned to any branch. Contact admin.");
  }
  // Staff should only have one branch; if multiple, use the first
  const branchId = staffBranches[0]._id?.toString();

  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });
  return res.json({ success: true, data: { user: formatted, access, refresh, branchId } });
}

export async function refresh(req: Request, res: Response) {
  const { refresh: refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError(400, "Refresh token required");
  }
  const payload = jwt.verify(refreshToken, JWT_SECRET) as { sub: string };
  const user = await User.findById(payload.sub).lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  return res.json({ success: true, data: { access } });
}

export async function me(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const user = await User.findById(authReq.user?.sub).select("-passwordHash").lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}

export async function updateMe(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { name, mobile, password } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (mobile !== undefined) update.mobile = mobile;
  if (password?.trim()) {
    update.passwordHash = await bcrypt.hash(password, 10);
  }
  const user = await User.findByIdAndUpdate(authReq.user?.sub, { $set: update }, { new: true }).select("-passwordHash").lean();
  if (!user) throw new AppError(404, "User not found");
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}

export async function updateUser(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }
  const { branches, name, mobile } = req.body;
  const update: Record<string, unknown> = {};
  if (branches !== undefined) update.branches = branches;
  if (name !== undefined) update.name = name;
  if (mobile !== undefined) update.mobile = mobile;
  const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select("-passwordHash").lean();
  if (!user) throw new AppError(404, "User not found");
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}

export async function listUsers(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can list users");
  }
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
  const enriched = await Promise.all(users.map(async (u) => {
    const b = await formatUserWithBranches(u);
    return b;
  }));
  return res.json({ success: true, data: enriched });
}

export async function listWarehouseUsers(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }
  const users = await User.find({ role: "warehouse" }).select("-passwordHash").sort({ createdAt: -1 }).lean();
  return res.json({ success: true, data: users.map(u => ({ id: u._id, username: u.username, name: u.name, mobile: u.mobile, role: u.role, createdAt: u.createdAt })) });
}

export async function deleteUser(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }
  const target = await User.findById(req.params.id).lean();
  if (!target) throw new AppError(404, "User not found");
  if (target.role !== "warehouse" && authReq.user.role === "warehouse") {
    throw new AppError(403, "Warehouse users can only delete warehouse accounts");
  }
  if (target.role === "owner") throw new AppError(400, "Cannot delete admin account");
  if (target._id.toString() === authReq.user.sub) throw new AppError(400, "Cannot delete yourself");
  await User.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "User deleted" });
}
