import { Response } from "express";
import * as shopLensCartService from "../services/shopLensCart.service";
import { sendSuccess, sendCreated } from "../utils/response";
import type { AuthRequest } from "../types";

export async function getItems(req: AuthRequest, res: Response) {
  const data = await shopLensCartService.getCartItems(req.user!.sub);
  sendSuccess(res, data);
}

export async function getCount(req: AuthRequest, res: Response) {
  const count = await shopLensCartService.getCartCount(req.user!.sub);
  sendSuccess(res, { count });
}

export async function addItem(req: AuthRequest, res: Response) {
  const { coating, lensType, powerKey, quantity } = req.body || {};
  if (!coating || !lensType || !powerKey) {
    res.status(400).json({ success: false, message: "coating, lensType, and powerKey are required" });
    return;
  }
  const data = await shopLensCartService.addToCart(
    req.user!.sub,
    String(coating),
    String(lensType),
    String(powerKey),
    Number(quantity) || 1
  );
  sendCreated(res, data);
}

export async function updateItem(req: AuthRequest, res: Response) {
  const { quantity } = req.body || {};
  if (typeof quantity !== "number" || quantity < 1) {
    res.status(400).json({ success: false, message: "quantity must be a positive number" });
    return;
  }
  const data = await shopLensCartService.updateCartItem(req.user!.sub, req.params.id, quantity);
  sendSuccess(res, data);
}

export async function removeItem(req: AuthRequest, res: Response) {
  await shopLensCartService.removeCartItem(req.user!.sub, req.params.id);
  sendSuccess(res, null, "Item removed");
}

export async function clearCart(req: AuthRequest, res: Response) {
  await shopLensCartService.clearCart(req.user!.sub);
  sendSuccess(res, null, "Cart cleared");
}

export async function withdraw(req: AuthRequest, res: Response) {
  const { note } = req.body || {};
  const data = await shopLensCartService.withdrawCart(
    req.user!.sub,
    req.user!.username || "user",
    typeof note === "string" ? note : undefined
  );
  sendSuccess(res, data, "Withdrawal complete");
}

export async function getWithdrawals(req: AuthRequest, res: Response) {
  const data = await shopLensCartService.getWithdrawals(req.user!.sub);
  sendSuccess(res, data);
}

export async function updateWithdrawal(req: AuthRequest, res: Response) {
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, message: "items array is required" });
    return;
  }
  const data = await shopLensCartService.updateWithdrawal(req.user!.sub, req.params.id, items);
  sendSuccess(res, data, "Withdrawal updated");
}

export async function deleteWithdrawal(req: AuthRequest, res: Response) {
  await shopLensCartService.deleteWithdrawal(req.user!.sub, req.params.id);
  sendSuccess(res, null, "Withdrawal deleted, stock restored");
}
