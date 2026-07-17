import { Request, Response } from "express";
import * as deliveryService from "../services/delivery.service";
import { sendSuccess } from "../utils/response";

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const data = await deliveryService.listDeliveries(status as string);
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await deliveryService.getDeliveryById(req.params.id);
  sendSuccess(res, data);
}
