import { Request, Response } from "express";
import * as branchService from "../services/branch.service";
import { sendSuccess, sendCreated } from "../utils/response";
import { listPageParamsFromQuery } from "../services/listBounds";

export async function listActive(req: Request, res: Response) {
  const data = await branchService.listActiveBranches(listPageParamsFromQuery(req.query));
  sendSuccess(res, data);
}

export async function listAll(req: Request, res: Response) {
  const data = await branchService.listAllBranches(listPageParamsFromQuery(req.query));
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await branchService.getBranchById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await branchService.createBranch(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await branchService.updateBranch(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await branchService.deleteBranch(req.params.id);
  sendSuccess(res, null, "Branch deactivated");
}
