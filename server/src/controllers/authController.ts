import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { signAccess, signRefresh, verifyToken } from "../utils/jwt";
import { JWT_SECRET } from "../config";
import { success, created } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password } = req.body;
    if (!username?.trim()) throw new AppError(400, "Username is required");
    if (!password?.trim()) throw new AppError(400, "Password is required");
    const existing = await User.findOne({ username });
    if (existing) throw new AppError(409, "Username already exists");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, role: "admin" });
    const token = signAccess({ sub: user._id, username: user.username });
    const refresh = signRefresh({ sub: user._id });
    return success(res, { user: { id: user._id, username: user.username, role: user.role }, access: token, refresh });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim()) throw new AppError(400, "Username and password required");
    const user = await User.findOne({ username });
    if (!user) throw new AppError(401, "Invalid credentials");
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError(401, "Invalid credentials");
    const token = signAccess({ sub: user._id, username: user.username });
    const refresh = signRefresh({ sub: user._id });
    return success(res, { user: { id: user._id, username: user.username, role: user.role }, access: token, refresh });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh: refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, "Refresh token required");
    const payload: any = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, "User not found");
    const token = signAccess({ sub: user._id, username: user.username });
    return success(res, { access: token });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById((req as any).user?.sub).select("-passwordHash");
    if (!user) throw new AppError(404, "User not found");
    return success(res, { id: user._id, username: user.username, role: user.role });
  } catch (err) {
    next(err);
  }
}
