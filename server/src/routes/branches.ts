import { Router } from "express";
import { Branch } from "../models/branch";
import { clearBranchCache } from "../models/db";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.get("/active", asyncHandler(async (_req, res) => {
  const branches = await Branch.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, data: branches });
}));

router.get("/", authenticate, asyncHandler(async (_req, res) => {
  const branches = await Branch.find().sort({ createdAt: 1 }).lean();
  res.json({ success: true, data: branches });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  res.json({ success: true, data: branch });
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const { name, code, dbName } = req.body;
  if (!name?.trim()) throw new AppError(400, "Branch name is required");
  if (!code?.trim()) throw new AppError(400, "Branch code is required");
  if (!dbName?.trim()) throw new AppError(400, "Database name is required");

  const existing = await Branch.findOne({
    $or: [{ code: code.trim() }, { dbName: dbName.trim() }],
  }).lean();
  if (existing) {
    throw new AppError(409, "Branch with this code or database name already exists");
  }

  const branch = await Branch.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    dbName: dbName.trim(),
    address: req.body.address || "",
    phone: req.body.phone || "",
    email: req.body.email || "",
    settings: req.body.settings || {},
  });

  clearBranchCache();

  res.json({ success: true, data: branch });
}));

router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  res.json({ success: true, data: branch });
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  ).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  res.json({ success: true, message: "Branch deactivated" });
}));

export default router;
