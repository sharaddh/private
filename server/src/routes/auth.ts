import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { signAccess, signRefresh } from "../utils/jwt";
import { JWT_SECRET } from "../config";
import { authenticate, AuthRequest } from "../middleware/auth";
import { verifyToken } from "../utils/jwt";

const router = Router();

const registerSchema = z.object({ username: z.string().min(3), password: z.string().min(6) });
const loginSchema = registerSchema;

router.post("/register", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Admin access required to create new users" });
      }
      try {
        verifyToken(authHeader.split(" ")[1]);
      } catch {
        return res.status(401).json({ success: false, message: "Invalid admin token" });
      }
    }
    const p = registerSchema.parse(req.body);
    const exists = await User.findOne({ username: p.username });
    if (exists) return res.status(400).json({ success: false, message: "Username already exists" });
    const hash = await bcrypt.hash(p.password, 10);
    const user = new User({ username: p.username, passwordHash: hash });
    await user.save();
    res.json({ success: true, data: { id: user._id, username: user.username } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
// router.post("/register", async (req, res) => {
//   try {
//     // 1. Removed the userCount check and admin token verification.
//     // Now anyone can register regardless of how many users exist.

//     const p = registerSchema.parse(req.body);
    
//     const exists = await User.findOne({ username: p.username });
//     if (exists) {
//       return res.status(400).json({ success: false, message: "Username already exists" });
//     }

//     const hash = await bcrypt.hash(p.password, 10);
//     const user = new User({ username: p.username, passwordHash: hash });
//     await user.save();

//     res.json({ success: true, data: { id: user._id, username: user.username } });
//   } catch (err: any) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// });   

router.post("/login", async (req, res) => {
  try {
    const p = loginSchema.parse(req.body);
    const user = await User.findOne({ username: p.username });
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });
    const ok = await bcrypt.compare(p.password, user.passwordHash);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid credentials" });
    const access = signAccess({ sub: user._id, username: user.username });
    const refresh = signRefresh({ sub: user._id });
    res.json({ success: true, data: { access, refresh } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ success: false, message: "Refresh token required" });
    const payload: any = jwt.verify(refresh, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const access = signAccess({ sub: user._id, username: user.username });
    res.json({ success: true, data: { access } });
  } catch (err: any) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user.sub).select("-passwordHash");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: { id: user._id, username: user.username, role: user.role } });
});

export default router;
