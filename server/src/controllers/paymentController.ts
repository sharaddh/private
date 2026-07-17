import { Request, Response } from "express";
import * as paymentService from "../services/payment.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function create(req: Request, res: Response) {
  const data = await paymentService.createPayment(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await paymentService.updatePayment(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await paymentService.deletePayment(req.params.id);
  sendSuccess(res, null, "Payment deleted");
}

export async function list(req: Request, res: Response) {
  const { customerId, billId, startDate, endDate, page, limit, cursor } = req.query;
  const data = await paymentService.listPayments({
    customerId: customerId as string,
    billId: billId as string,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page as string,
    limit: limit as string,
    cursor: cursor as string,
  });
  sendSuccess(res, data);
}
