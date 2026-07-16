import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { isConnected, cacheKeys, cacheFlushAll } from "../services/cache";

const router = Router();

router.get("/status", authenticate, asyncHandler(async (_req, res) => {
  const connected = isConnected();
  const keyCount = connected ? (await cacheKeys("*")).length : 0;
  res.json({ success: true, data: { connected, keyCount } });
}));

router.post("/flush", authenticate, requireRole("owner"), asyncHandler(async (_req, res) => {
  const count = await cacheFlushAll();
  res.json({ success: true, message: `Flushed ${count} cache keys` });
}));

export default router;
