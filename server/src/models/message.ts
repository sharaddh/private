import { prisma, type Prisma } from "../db/prisma";

export const Message = prisma.message as Prisma.MessageDelegate;
