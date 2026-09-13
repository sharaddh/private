import { Request, Response } from "express";
import { sendSuccess, sendCreated } from "../utils/response";
import { createDemandSchema, updateDemandSchema } from "../validators/warehouseDemand.validator";
import * as warehouseDemandService from "../services/warehouseDemand.service";
import type { AuthRequest } from "../types";

export async function list(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const data = await warehouseDemandService.listDemands(status);
  sendSuccess(res, data);
}

export async function create(req: AuthRequest, res: Response) {
  const body = createDemandSchema.parse(req.body);
  const data = await warehouseDemandService.createDemand(body.items, req.user?.username || "");
  sendCreated(res, data, "Demand created");
}

export async function getById(req: Request, res: Response) {
  const data = await warehouseDemandService.getDemand(req.params.id);
  sendSuccess(res, data);
}

export async function updateItems(req: Request, res: Response) {
  const body = updateDemandSchema.parse(req.body);
  const data = await warehouseDemandService.updateDemandItems(req.params.id, body.items);
  sendSuccess(res, data, "Demand updated");
}

export async function send(req: Request, res: Response) {
  const data = await warehouseDemandService.sendDemand(req.params.id);
  sendSuccess(res, data, "Demand sent");
}

export async function close(req: Request, res: Response) {
  const data = await warehouseDemandService.closeDemand(req.params.id);
  sendSuccess(res, data, "Demand closed");
}

export async function remove(req: Request, res: Response) {
  await warehouseDemandService.deleteDemand(req.params.id);
  sendSuccess(res, null, "Demand deleted");
}