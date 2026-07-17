import { Request, Response } from "express";
import * as reportService from "../services/report.service";
import { sendSuccess } from "../utils/response";

export async function revenue(req: Request, res: Response) {
  const { startDate, endDate } = req.query;
  const data = await reportService.getRevenueReport(startDate as string, endDate as string);
  sendSuccess(res, data);
}

export async function monthly(_req: Request, res: Response) {
  const data = await reportService.getMonthlyReport();
  sendSuccess(res, data);
}

export async function customer(req: Request, res: Response) {
  const { city, startDate, endDate } = req.query;
  const data = await reportService.getCustomerReport({
    city: city as string,
    startDate: startDate as string,
    endDate: endDate as string,
  });
  sendSuccess(res, data);
}

export async function inventory(req: Request, res: Response) {
  const { category } = req.query;
  const data = await reportService.getInventoryReport(category as string);
  sendSuccess(res, data);
}

export async function delivery(_req: Request, res: Response) {
  const data = await reportService.getDeliveryReport();
  sendSuccess(res, data);
}
