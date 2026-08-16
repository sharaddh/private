import { Visit } from "../models/visit";
import { Customer } from "../models/customer";
import { AppError } from "../middleware/errorHandler";
import { requireBranchId } from "../utils/scope";

interface VisitData {
  customerId?: string;
  visitDate?: Date;
  visitType?: string;
  doctorName?: string;
  shop?: string;
  shopId?: string;
  remarks?: string;
}

const UPDATE_WHITELIST = [
  "customerId",
  "visitDate",
  "visitType",
  "doctorName",
  "shop",
  "shopId",
  "remarks",
] as const;

export async function listVisits(customerId?: string, limit = 100) {
  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = customerId;
  return Visit.findMany({
    where,
    orderBy: { visitDate: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function getVisitById(id: string) {
  const visit = await Visit.findUnique({ where: { id } });
  if (!visit) throw new AppError(404, "Visit not found");
  return visit;
}

export async function createVisit(data: VisitData) {
  if (!data.customerId) throw new AppError(400, "Customer ID is required");
  const visit = await Visit.create({ data: { customerId: data.customerId!, visitDate: data.visitDate, visitType: data.visitType, doctorName: data.doctorName, shop: data.shop, shopId: data.shopId, remarks: data.remarks, branchId: requireBranchId() } });
  await Customer.update({
    where: { id: data.customerId },
    data: { totalVisits: { increment: 1 } },
  });
  return visit;
}

export async function updateVisit(id: string, data: VisitData) {
  const existing = await Visit.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Visit not found");

  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = (data as Record<string, unknown>)[key];
    }
  }
  return Visit.update({ where: { id }, data: filtered });
}

export async function deleteVisit(id: string) {
  const visit = await Visit.findUnique({ where: { id } });
  if (!visit) throw new AppError(404, "Visit not found");
  await Visit.delete({ where: { id } });
  await Customer.update({
    where: { id: visit.customerId },
    data: { totalVisits: { decrement: 1 } },
  });
  return visit;
}
