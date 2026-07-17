import { BranchRequest } from "../types";
import { Response } from "express";
import { executeTransaction } from "../services/workspace.service";
import { sendSuccess } from "../utils/response";

export async function transaction(req: BranchRequest, res: Response) {
  const data = await executeTransaction(req.body, req.branchId);
  sendSuccess(res, data, "Transaction completed");
}
