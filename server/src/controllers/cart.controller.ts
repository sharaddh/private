import { Response } from "express";
import * as cartService from "../services/cart.service";
import { sendSuccess, sendCreated } from "../utils/response";
import type { AuthRequest } from "../types";

export async function getItems(req: AuthRequest, res: Response) {
  const data = await cartService.getCartItems(req.user!.sub);
  sendSuccess(res, data);
}

export async function getCount(req: AuthRequest, res: Response) {
  const count = await cartService.getCartCount(req.user!.sub);
  sendSuccess(res, { count });
}

export async function addItem(req: AuthRequest, res: Response) {
  const { coating, lensType, powerKey, quantity, fogMark } = req.body;
  if (!coating || !lensType || !powerKey) {
    res.status(400).json({ success: false, message: "coating, lensType, and powerKey are required" });
    return;
  }
  if (!["sph", "cyl", "compound"].includes(lensType)) {
    res.status(400).json({ success: false, message: "lensType must be sph, cyl, or compound" });
    return;
  }
  const data = await cartService.addToCart(req.user!.sub, coating, lensType, powerKey, quantity || 1, typeof fogMark === "string" ? fogMark : "");
  sendCreated(res, data);
}

export async function updateItem(req: AuthRequest, res: Response) {
  const { quantity, fogMark } = req.body;
  if (typeof quantity !== "number" || quantity < 1) {
    res.status(400).json({ success: false, message: "quantity must be a positive number" });
    return;
  }
  const data = await cartService.updateCartItem(
    req.user!.sub,
    req.params.id,
    quantity,
    typeof fogMark === "string" ? fogMark : undefined
  );
  sendSuccess(res, data);
}

export async function removeItem(req: AuthRequest, res: Response) {
  await cartService.removeCartItem(req.user!.sub, req.params.id);
  sendSuccess(res, null, "Item removed");
}

export async function clearCart(req: AuthRequest, res: Response) {
  await cartService.clearCart(req.user!.sub);
  sendSuccess(res, null, "Cart cleared");
}

export async function withdraw(req: AuthRequest, res: Response) {
  const data = await cartService.withdrawCart(req.user!.sub, req.user!.username);
  sendSuccess(res, data, "Withdrawal complete");
}

export async function getMyWithdrawals(req: AuthRequest, res: Response) {
  const data = await cartService.getWithdrawals(req.user!.sub);
  sendSuccess(res, data);
}

export async function getAllWithdrawals(_req: AuthRequest, res: Response) {
  const data = await cartService.getAllWithdrawals();
  sendSuccess(res, data);
}

export async function markWithdrawalPaid(req: AuthRequest, res: Response) {
  const paid = (req.body || {}).paid !== false;
  const data = await cartService.markWithdrawalPaid(req.user!.sub, req.params.id, paid);
  sendSuccess(res, data, paid ? "Withdrawal marked as paid" : "Withdrawal marked as unpaid");
}

export async function updateWithdrawal(req: AuthRequest, res: Response) {
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, message: "items array is required" });
    return;
  }
  const data = await cartService.updateWithdrawal(req.user!.sub, req.params.id, items);
  sendSuccess(res, data, "Withdrawal updated");
}

export async function sendWithdrawalPdf(req: AuthRequest, res: Response) {
  const { phone } = req.body || {};
  const data = await cartService.sendWithdrawalPdf(
    req.user!.sub,
    req.params.id,
    typeof phone === "string" ? phone : undefined
  );
  sendSuccess(res, data, "Lens list PDF sent on WhatsApp");
}
