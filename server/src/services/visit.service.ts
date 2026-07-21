import mongoose from "mongoose";
import { Visit } from "../models/visit";
import { Customer } from "../models/customer";
import { AppError } from "../middleware/errorHandler";

interface VisitData {
  customerId?: string;
  visitDate?: Date;
  visitType?: string;
  doctorName?: string;
  shop?: string;
  shopId?: string;
  remarks?: string;
}

const UPDATE_WHITELIST = ["customerId", "visitDate", "visitType", "doctorName", "shop", "shopId", "remarks"] as const;

export async function listVisits(customerId?: string) {
  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  return Visit.find(filter).sort({ visitDate: -1 }).limit(200).lean();
}

export async function getVisitById(id: string) {
  const visit = await Visit.findById(id).lean();
  if (!visit) throw new AppError(404, "Visit not found");
  return visit;
}

export async function createVisit(data: VisitData) {
  if (!data.customerId) throw new AppError(400, "Customer ID is required");
  const visit = await Visit.create(data);
  await Customer.findByIdAndUpdate(data.customerId, { $inc: { totalVisits: 1 } }).exec();
  return visit;
}

export async function updateVisit(id: string, data: VisitData) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = (data as Record<string, unknown>)[key];
    }
  }
  const visit = await Visit.findByIdAndUpdate(id, { $set: filtered }, { new: true, runValidators: true }).lean();
  if (!visit) throw new AppError(404, "Visit not found");
  return visit;
}

export async function deleteVisit(id: string) {
  const visit = await Visit.findByIdAndDelete(id).lean();
  if (!visit) throw new AppError(404, "Visit not found");
  await Customer.findByIdAndUpdate(visit.customerId, { $inc: { totalVisits: -1 } }).exec();
  return visit;
}
