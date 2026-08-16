import { prisma, type Prisma } from "../db/prisma";

export const User = prisma.user as Prisma.UserDelegate;
