import { Response } from "express";
import { AuthRequest } from "../types";
import * as authService from "../services/auth.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function register(req: AuthRequest, res: Response) {
  const data = await authService.registerUser(req.body, req.user?.role || "");
  sendCreated(res, data);
}

export async function login(req: AuthRequest, res: Response) {
  const { username, password, branchId } = req.body;
  const data = await authService.loginUser({ username, password, branchId });
  sendSuccess(res, data);
}

export async function staffLogin(req: AuthRequest, res: Response) {
  const { username, password } = req.body;
  const data = await authService.staffLogin({ username, password });
  sendSuccess(res, data);
}

export async function warehouseLogin(req: AuthRequest, res: Response) {
  const { username, password } = req.body;
  const data = await authService.warehouseLogin({ username, password });
  sendSuccess(res, data);
}

export async function warehouseRegister(req: AuthRequest, res: Response) {
  const data = await authService.registerWarehouseUser(req.body, req.user?.role || "");
  sendCreated(res, data);
}

export async function refresh(req: AuthRequest, res: Response) {
  const { refresh: refreshToken } = req.body;
  const data = await authService.refreshToken(refreshToken);
  sendSuccess(res, data);
}

export async function me(req: AuthRequest, res: Response) {
  const data = await authService.getProfile(req.user?.sub || "");
  sendSuccess(res, data);
}

export async function updateMe(req: AuthRequest, res: Response) {
  const data = await authService.updateProfile(req.user?.sub || "", req.body);
  sendSuccess(res, data);
}

export async function updateUser(req: AuthRequest, res: Response) {
  const data = await authService.updateUser(req.params.id, req.body, req.user?.role || "");
  sendSuccess(res, data);
}

export async function listUsers(req: AuthRequest, res: Response) {
  const data = await authService.listUsers(req.user?.role || "");
  sendSuccess(res, data);
}

export async function listWarehouseUsers(req: AuthRequest, res: Response) {
  const data = await authService.listWarehouseUsers(req.user?.role || "");
  sendSuccess(res, data);
}

export async function deleteUser(req: AuthRequest, res: Response) {
  await authService.deleteUser(req.params.id, req.user?.role || "", req.user?.sub || "");
  sendSuccess(res, null, "User deleted");
}
