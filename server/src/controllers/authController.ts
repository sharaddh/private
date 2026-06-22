import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { signAccess, signRefresh } from "../utils/jwt";
import { JWT_SECRET } from "../config";

export async function register(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ success: false, message: "Username already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, role: "owner" });
    const access = signAccess({ sub: user._id, username: user.username });
    const refresh = signRefresh({ sub: user._id });
    return res.json({ success: true, data: { user: { id: user._id, username: user.username, role: user.role }, access, refresh } });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const access = signAccess({ sub: user._id, username: user.username });
    const refresh = signRefresh({ sub: user._id });
    return res.json({ success: true, data: { user: { id: user._id, username: user.username, role: user.role }, access, refresh } });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refresh: refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token required" });
    }
    const payload: any = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const access = signAccess({ sub: user._id, username: user.username });
    return res.json({ success: true, data: { access } });
  } catch (err: any) {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const user = await User.findById((req as any).user?.sub).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, data: { id: user._id, username: user.username, role: user.role } });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
