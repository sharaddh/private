import { Request, Response } from "express";
import * as customerService from "../services/customer.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function getAll(req: Request, res: Response) {
  const { phone, search, page, limit, cursor, startDate, endDate } = req.query;
  const data = await customerService.listCustomers({
    phone: phone as string,
    search: search as string,
    page: page as string,
    limit: limit as string,
    cursor: cursor as string,
    startDate: startDate as string,
    endDate: endDate as string,
  });
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await customerService.getCustomerById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await customerService.createCustomer(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await customerService.updateCustomer(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await customerService.deleteCustomer(req.params.id);
  sendSuccess(res, null, "Customer deleted");
}

export async function getSummary(req: Request, res: Response) {
  const data = await customerService.getCustomerSummary(req.params.id);
  sendSuccess(res, data);
}
