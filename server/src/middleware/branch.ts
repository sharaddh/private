import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma";
import { ctx, getCtx, type RequestContext } from "../utils/requestContext";
import { logger } from "../utils/logger";
import type { BranchRequest } from "../types";

export type { BranchRequest } from "../types";

export async function branchScope(
  req: BranchRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const branchId = (req.headers["x-branch-id"] as string) || (req.query._branch as string);

  if (branchId) {
    try {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (branch && branch.isActive) {
        if (req.user) {
          const role = req.user.role;
          if (role !== "owner" && role !== "staff") {
            res.status(403).json({ success: false, message: "Forbidden" });
            return;
          }
          if (role === "staff") {
            const user = await prisma.user.findUnique({
              where: { id: req.user.sub },
              select: { branches: { select: { id: true } } },
            });
            if (!user?.branches.some((assigned) => assigned.id === branch.id)) {
              res.status(403).json({ success: false, message: "Forbidden" });
              return;
            }
          }

          req.branchId = branch.id;
          req.branchDb = branch.dbName;
          req.branchName = branch.name;

          const requestCtx: RequestContext = {
            ...getCtx(),
            branchId: req.branchId,
            branchName: req.branchName,
          };

          ctx.run(requestCtx, () => next());
          return;
        }
      }
    } catch (err) {
      logger.error("Branch scope lookup failed", { error: (err as Error).message });
    }
  }
  next();
}
