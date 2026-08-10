import { Request, Response } from "express";
import * as inventoryCountService from "../services/inventoryCount.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { AuthRequest } from "../types";

export async function createCountSession(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryCountService.createCountSession(req.body.rackId, by);
  sendCreated(res, data, "Count session started");
}

export async function listCountSessions(req: Request, res: Response) {
  const data = await inventoryCountService.listCountSessions({
    page: req.query.page as string | undefined,
    limit: req.query.limit as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getCountSession(req: Request, res: Response) {
  const data = await inventoryCountService.getCountSession(req.params.id);
  sendSuccess(res, data);
}

export async function updateCountEntries(req: Request, res: Response) {
  const data = await inventoryCountService.updateCountEntries(req.params.id, req.body.entries);
  sendSuccess(res, data, "Count entries updated");
}

export async function completeCountSession(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryCountService.completeCountSession(req.params.id, by, req.body.note);
  sendSuccess(res, data, "Count session completed");
}

export async function cancelCountSession(req: AuthRequest, res: Response) {
  const by = req.user?.username || "";
  const data = await inventoryCountService.cancelCountSession(req.params.id, by);
  sendSuccess(res, data, "Count session cancelled");
}
