import { Request, Response } from "express";
import * as cacheAdminService from "../services/cacheAdmin.service";
import { sendSuccess } from "../utils/response";

export async function status(_req: Request, res: Response) {
  const data = await cacheAdminService.getStatus();
  sendSuccess(res, data);
}

export async function flush(_req: Request, res: Response) {
  const data = await cacheAdminService.flushCache();
  sendSuccess(res, data, "Cache flushed");
}
