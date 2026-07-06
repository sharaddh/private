import { Response, NextFunction } from "express";
import { Branch } from "../models/branch";
import { getBranchModels, type BranchModels } from "../models/db";
import { ctx, type RequestContext } from "../utils/requestContext";
import type { AuthRequest } from "./auth";

export interface BranchRequest extends AuthRequest {
  branchId?: string;
  branchDb?: string;
  branchName?: string;
  branchModels?: BranchModels;
}

export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction) {
  const branchId = req.headers["x-branch-id"] as string || req.query._branch as string;

  if (branchId) {
    try {
      const branch = await Branch.findById(branchId).lean();
      if (branch && branch.isActive) {
        req.branchId = branch._id.toString();
        req.branchDb = branch.dbName;
        req.branchName = branch.name;
        const branchModels = getBranchModels(branch.dbName);
        req.branchModels = branchModels;

        const requestCtx: RequestContext = {
          branchId: req.branchId,
          branchName: req.branchName,
          branchModels,
        };

        ctx.run(requestCtx, () => next());
        return;
      }
    } catch (err) {
      console.error("Branch scope lookup failed:", err);
    }
  }
  next();
}
