import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { User } from "../models/user";
import { signAccess, signRefresh } from "../utils/jwt";

const router = Router();

const registerSchema = z.object({ username: z.string().min(3), password: z.string().min(6) });
const loginSchema = registerSchema;

router.post("/register", async (req, res) => {
  try {
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

export default router;
