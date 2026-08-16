import { Prescription } from "../models/prescription";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { AppError } from "../middleware/errorHandler";

interface PrescriptionData {
  customerId?: string;
  visitId?: string;
  rightEye?: Record<string, unknown>;
  leftEye?: Record<string, unknown>;
  pd?: string;
  notes?: string;
}

const UPDATE_WHITELIST = ["customerId", "visitId", "rightEye", "leftEye", "pd", "notes"] as const;

export async function listPrescriptions(customerId?: string, limit = 100) {
  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = customerId;
  return Prescription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function getPrescriptionById(id: string) {
  const prescription = await Prescription.findUnique({ where: { id } });
  if (!prescription) throw new AppError(404, "Prescription not found");
  return prescription;
}

export async function createPrescription(data: PrescriptionData) {
  if (!data.customerId) throw new AppError(400, "Customer ID is required");

  const customer = await Customer.findUnique({ where: { id: data.customerId } });
  if (!customer) throw new AppError(404, "Customer not found");

  if (data.visitId) {
    const visit = await Visit.findUnique({ where: { id: data.visitId } });
    if (!visit) throw new AppError(404, "Visit not found");
  }

  return Prescription.create({ data: data as any });
}

export async function updatePrescription(id: string, data: PrescriptionData) {
  const existing = await Prescription.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Prescription not found");

  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = (data as Record<string, unknown>)[key];
    }
  }
  return Prescription.update({ where: { id }, data: filtered });
}

export async function deletePrescription(id: string) {
  const prescription = await Prescription.findUnique({ where: { id } });
  if (!prescription) throw new AppError(404, "Prescription not found");
  await Prescription.delete({ where: { id } });
  return prescription;
}
