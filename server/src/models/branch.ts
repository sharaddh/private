import { prisma, type Prisma } from "../db/prisma";

export const Branch = prisma.branch as Prisma.BranchDelegate;
