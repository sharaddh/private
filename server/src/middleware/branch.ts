import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma";
import { ctx, type RequestContext } from "../utils/requestContext";
import { logger } from "../utils/logger";
import type { BranchRequest } from "../types";

export type { BranchRequest } from "../types";

export async function branchScope(
  req: BranchRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const branchId = (req.headers["x-branch-id"] as string) || (req.query._branch as string);

  if (branchId) {
    try {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (branch && branch.isActive) {
        req.branchId = branch.id;
        req.branchDb = branch.dbName;
        req.branchName = branch.name;

        const requestCtx: RequestContext = {
          branchId: req.branchId,
          branchName: req.branchName,
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
