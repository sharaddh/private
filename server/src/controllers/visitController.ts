import { Request, Response } from "express";
import * as visitService from "../services/visit.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { listPageParamsFromQuery } from "../services/listBounds";

export async function list(req: Request, res: Response) {
  const { customerId } = req.query;
  const data = await visitService.listVisits(
    customerId as string,
    listPageParamsFromQuery(req.query)
  );
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await visitService.getVisitById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await visitService.createVisit(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await visitService.updateVisit(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await visitService.deleteVisit(req.params.id);
  sendSuccess(res, null, "Visit deleted");
}
