import { Request, Response } from "express";
import * as billService from "../services/bill.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function create(req: Request, res: Response) {
  const { customerId, visitId, ...rest } = req.body;
  const data = await billService.createBill(rest, customerId, visitId);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await billService.updateBill(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await billService.deleteBill(req.params.id);
  sendSuccess(res, null, "Bill deleted");
}

export async function getById(req: Request, res: Response) {
  const data = await billService.getBillById(req.params.id);
  sendSuccess(res, data);
}

export async function list(req: Request, res: Response) {
  const { customerId, startDate, endDate, page, limit, cursor } = req.query;
  const data = await billService.listBills({
    customerId: customerId as string,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page as string,
    limit: limit as string,
    cursor: cursor as string,
  });
  sendSuccess(res, data);
}
