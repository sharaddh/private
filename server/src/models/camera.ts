import { prisma, type Prisma } from "../db/prisma";

export const Camera = prisma.camera as Prisma.CameraDelegate;
