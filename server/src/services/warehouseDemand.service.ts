import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";

const DemandList = prisma.warehouseDemandList;

const ITEMS_INCLUDE = { items: true } as const;

function notFound() {
  return new AppError(404, "Demand not found");
}

export interface DemandItemInput {
  coating: string;
  lensType: string;
  powerKey: string;
  qty: number;
}

export async function listDemands(status?: string) {
  const where =
    status === "open" || status === "sent" || status === "closed" ? { status } : {};
  return DemandList.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: ITEMS_INCLUDE,
  });
}

export async function createDemand(items: DemandItemInput[] | undefined, createdBy: string) {
  return DemandList.create({
    data: {
      status: "open",
      createdBy,
      items: items && items.length > 0 ? { create: items } : undefined,
    },
    include: ITEMS_INCLUDE,
  });
}

export async function getDemand(id: string) {
  const list = await DemandList.findUnique({ where: { id }, include: ITEMS_INCLUDE });
  if (!list) throw notFound();
  return list;
}

export async function updateDemandItems(id: string, items: DemandItemInput[]) {
  const list = await DemandList.findUnique({ where: { id } });
  if (!list) throw notFound();
  if (list.status !== "open") {
    throw new AppError(409, "Only open demand lists can be edited");
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.warehouseDemandItem.deleteMany({ where: { listId: id } });
    await tx.warehouseDemandItem.createMany({
      data: items.map((i) => ({ ...i, listId: id })),
    });
    return tx.warehouseDemandList.findUnique({ where: { id }, include: ITEMS_INCLUDE });
  });
  if (!updated) throw notFound();
  return updated;
}

export async function sendDemand(id: string) {
  const list = await DemandList.findUnique({ where: { id }, include: ITEMS_INCLUDE });
  if (!list) throw notFound();
  if (list.status !== "open") {
    throw new AppError(409, "Only open demand lists can be sent");
  }
  if (list.items.length === 0) {
    throw new AppError(400, "Cannot send an empty demand list");
  }
  return DemandList.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
    include: ITEMS_INCLUDE,
  });
}

export async function closeDemand(id: string) {
  const list = await DemandList.findUnique({ where: { id } });
  if (!list) throw notFound();
  if (list.status !== "sent") {
    throw new AppError(409, "Only sent demand lists can be closed");
  }
  return DemandList.update({
    where: { id },
    data: { status: "closed", closedAt: new Date() },
    include: ITEMS_INCLUDE,
  });
}

export async function deleteDemand(id: string) {
  const list = await DemandList.findUnique({ where: { id } });
  if (!list) throw notFound();
  if (list.status !== "open") {
    throw new AppError(409, "Only open demand lists can be deleted");
  }
  await DemandList.delete({ where: { id } });
  return { id };
}