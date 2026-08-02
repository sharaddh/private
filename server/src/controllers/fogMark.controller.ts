import { Response } from "express";
import * as fogMarkService from "../services/fogMark.service";
import { sendSuccess, sendCreated } from "../utils/response";
import type { AuthRequest } from "../types";

export async function list(_req: AuthRequest, res: Response) {
  const data = await fogMarkService.listFogMarks();
  sendSuccess(res, data);
}

export async function getById(req: AuthRequest, res: Response) {
  const data = await fogMarkService.getFogMark(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: AuthRequest, res: Response) {
  const { name } = req.body || {};
  if (typeof name !== "string") {
    res.status(400).json({ success: false, message: "name is required" });
    return;
  }
  const data = await fogMarkService.createFogMark(name);
  sendCreated(res, data, "Fog mark created");
}

export async function update(req: AuthRequest, res: Response) {
  const { name } = req.body || {};
  if (typeof name !== "string") {
    res.status(400).json({ success: false, message: "name is required" });
    return;
  }
  const data = await fogMarkService.updateFogMark(req.params.id, name);
  sendSuccess(res, data, "Fog mark updated");
}

export async function remove(req: AuthRequest, res: Response) {
  await fogMarkService.deleteFogMark(req.params.id);
  sendSuccess(res, null, "Fog mark deleted");
}
