import { Request, Response } from "express";
import * as settingsService from "../services/settings.service";
import { sendSuccess } from "../utils/response";

export async function get(_req: Request, res: Response) {
  const data = await settingsService.getSettings();
  sendSuccess(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await settingsService.updateSettings(req.body);
  sendSuccess(res, data);
}
