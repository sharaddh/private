import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { whatsapp } from "../services/whatsapp";

const router = Router();

router.get("/status", authenticate, async (_req, res: Response) => {
  const status = await whatsapp.getStatus();
  res.json({ success: true, data: status });
});

router.get("/qr", authenticate, async (_req, res: Response) => {
  const status = await whatsapp.getStatus();
  if (status.status === "qr") {
    res.json({ success: true, data: { qr: status.qr } });
  } else {
    res.json({ success: true, data: { qr: null, status: status.status } });
  }
});

router.post("/send", authenticate, async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      res.status(400).json({ success: false, message: "Phone and message required" });
      return;
    }
    const ok = await whatsapp.sendMessage(phone, message);
    res.json({ success: ok, message: ok ? "Sent" : "Failed to send" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/broadcast", authenticate, async (req: Request, res: Response) => {
  try {
    const { numbers, message } = req.body;
    if (!numbers?.length || !message) {
      res.status(400).json({ success: false, message: "Numbers and message required" });
      return;
    }
    const result = await whatsapp.broadcast(numbers, message);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
