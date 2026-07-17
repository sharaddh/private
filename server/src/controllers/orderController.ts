import { Response } from "express";
import { BranchRequest } from "../types";
import * as orderService from "../services/order.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function create(req: BranchRequest, res: Response) {
  const data = await orderService.createOrder(req.body);
  sendCreated(res, data);
}

export async function update(req: BranchRequest, res: Response) {
  const data = await orderService.updateOrder(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: BranchRequest, res: Response) {
  await orderService.deleteOrder(req.params.id);
  sendSuccess(res, null, "Order deleted");
}

export async function getById(req: BranchRequest, res: Response) {
  const data = await orderService.getOrderById(req.params.id);
  sendSuccess(res, data);
}

export async function list(req: BranchRequest, res: Response) {
  const { customerId, status, startDate, endDate, dateField, page, limit, cursor } = req.query;
  const data = await orderService.listOrders({
    customerId: customerId as string,
    status: status as string,
    startDate: startDate as string,
    endDate: endDate as string,
    dateField: dateField as string,
    page: page as string,
    limit: limit as string,
    cursor: cursor as string,
  });
  sendSuccess(res, data);
}

export async function updateStatus(req: BranchRequest, res: Response) {
  const data = await orderService.updateOrderStatus(req.params.id, {
    ...req.body,
    branchId: req.branchId,
  });
  sendSuccess(res, data);
}

export async function setClassification(req: BranchRequest, res: Response) {
  const { classification } = req.body;
  const data = await orderService.setClassification(req.params.id, classification);
  sendSuccess(res, data);
}

export async function setEyeClassification(req: BranchRequest, res: Response) {
  const { eye, status } = req.body;
  const data = await orderService.setEyeClassification(req.params.id, eye, status);
  sendSuccess(res, data);
}

export async function setReviewed(req: BranchRequest, res: Response) {
  const { reviewed } = req.body;
  const data = await orderService.setReviewed(req.params.id, reviewed);
  sendSuccess(res, data);
}
