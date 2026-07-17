import { Request, Response } from "express";
import * as dashboardService from "../services/dashboard.service";
import { sendSuccess } from "../utils/response";

export async function getStats(_req: Request, res: Response) {
  const data = await dashboardService.getStats();
  sendSuccess(res, data);
}
