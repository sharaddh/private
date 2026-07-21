import { Response, NextFunction } from "express";
import { Branch } from "../models/branch";
import { getBranchModels } from "../models/db";
import { ctx, type RequestContext } from "../utils/requestContext";
import { logger } from "../utils/logger";
import type { AuthRequest, BranchRequest, BranchModels } from "../types";

export type { BranchRequest } from "../types";

export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction): Promise<void> {
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
      logger.error("Branch scope lookup failed", { error: (err as Error).message });
    }
  }
  next();
}
