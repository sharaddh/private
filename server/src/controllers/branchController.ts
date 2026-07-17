import { Request, Response } from "express";
import * as branchService from "../services/branch.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function listActive(_req: Request, res: Response) {
  const data = await branchService.listActiveBranches();
  sendSuccess(res, data);
}

export async function listAll(_req: Request, res: Response) {
  const data = await branchService.listAllBranches();
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
