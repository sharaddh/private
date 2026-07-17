import { Request, Response } from "express";
import * as recalculateService from "../services/recalculate.service";
import { sendSuccess } from "../utils/response";

export async function recalculate(_req: Request, res: Response) {
  const data = await recalculateService.recalculateCustomerTotals();
  sendSuccess(res, data, `Recalculated ${data.updated} of ${data.total} customers`);
}
