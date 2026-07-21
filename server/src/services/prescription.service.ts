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

export async function listPrescriptions(customerId?: string) {
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  return Prescription.find(filter).sort({ createdAt: -1 }).limit(200).lean();
}

export async function getPrescriptionById(id: string) {
  const prescription = await Prescription.findById(id).lean();
  if (!prescription) throw new AppError(404, "Prescription not found");
  return prescription;
}

export async function createPrescription(data: PrescriptionData) {
  if (!data.customerId) throw new AppError(400, "Customer ID is required");

  const customer = await Customer.findById(data.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");

  if (data.visitId) {
    const visit = await Visit.findById(data.visitId).lean();
    if (!visit) throw new AppError(404, "Visit not found");
  }

  return Prescription.create(data);
}

export async function updatePrescription(id: string, data: PrescriptionData) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = (data as Record<string, unknown>)[key];
    }
  }
  const prescription = await Prescription.findByIdAndUpdate(id, { $set: filtered }, { new: true, runValidators: true }).lean();
  if (!prescription) throw new AppError(404, "Prescription not found");
  return prescription;
}

export async function deletePrescription(id: string) {
  const prescription = await Prescription.findByIdAndDelete(id).lean();
  if (!prescription) throw new AppError(404, "Prescription not found");
  return prescription;
}
