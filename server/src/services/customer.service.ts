import mongoose from "mongoose";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Prescription } from "../models/prescription";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { paginateQuery, parseDateRange, buildDateFilter } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import type { PaginatedResult } from "../types";

interface CustomerFilters {
  search?: string;
  phone?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

interface CreateCustomerData {
  name: string;
  mobile: string;
  email?: string;
  age?: number;
  gender?: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  tags?: string[];
}

interface UpdateCustomerData {
  name?: string;
  mobile?: string;
  email?: string;
  age?: number;
  gender?: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  tags?: string[];
}

interface CustomerResult {
  _id: mongoose.Types.ObjectId;
  customerId: string;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  mobile: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  tags: string[];
  totalVisits: number;
  totalSpent: number;
  pendingAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerSummary extends CustomerResult {
  visitCount: number;
  orderCount: number;
  totalBilled: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateCustomerId(): string {
  return `CUST-${Date.now()}`;
}

export async function listCustomers(
  filters: CustomerFilters
): Promise<PaginatedResult<CustomerResult>> {
  const filter: Record<string, unknown> = {};

  if (filters.phone) {
    filter.mobile = { $regex: filters.phone, $options: "i" };
  }

  if (filters.search) {
    const s = filters.search.trim();
    const searchRegex = { $regex: escapeRegex(s), $options: "i" };
    filter.$or = [
      { name: searchRegex },
      { mobile: searchRegex },
      { customerId: searchRegex },
      { email: searchRegex },
      { alternateMobile: searchRegex },
      { city: searchRegex },
    ];
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateFilter = buildDateFilter("createdAt", start, end);
  if (dateFilter) {
    Object.assign(filter, dateFilter);
  }

  const query = Customer.find(filter).sort({ createdAt: -1 });

  return paginateQuery(query as never, {
    page: filters.page,
    limit: filters.limit,
    cursor: filters.cursor,
  }) as unknown as Promise<PaginatedResult<CustomerResult>>;
}

export async function getCustomerById(id: string): Promise<CustomerResult> {
  const customer = await Customer.findById(id).lean();
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }
  return customer as unknown as CustomerResult;
}

export async function createCustomer(data: CreateCustomerData): Promise<CustomerResult> {
  if (!data.name?.trim()) {
    throw new AppError(400, "Name is required");
  }
  if (!data.mobile?.trim()) {
    throw new AppError(400, "Mobile is required");
  }

  const customer = await Customer.create({
    ...data,
    customerId: generateCustomerId(),
    mobile: data.mobile.trim(),
  });

  return customer.toObject() as unknown as CustomerResult;
}

export async function updateCustomer(
  id: string,
  updates: UpdateCustomerData
): Promise<CustomerResult> {
  const customer = await (Customer as mongoose.Model<unknown>).findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).lean();
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }
  return customer as unknown as CustomerResult;
}

export async function deleteCustomer(id: string): Promise<void> {
  const customer = await Customer.findByIdAndDelete(id).lean();
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  await Promise.all([
    Visit.deleteMany({ customerId: id }),
    Order.deleteMany({ customerId: id }),
    Bill.deleteMany({ customerId: id }),
    Prescription.deleteMany({ customerId: id }),
    Payment.deleteMany({ customerId: id }),
    Delivery.deleteMany({ customerId: id }),
  ]);
}

export async function getCustomerSummary(id: string): Promise<CustomerSummary> {
  const customer = await Customer.findById(id).lean();
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  const [visitCount, orderCount, billTotal] = await Promise.all([
    Visit.countDocuments({ customerId: id }),
    Order.countDocuments({ customerId: id }),
    Bill.aggregate([
      { $match: { customerId: id } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  return {
    ...(customer as unknown as CustomerResult),
    visitCount,
    orderCount,
    totalBilled: billTotal[0]?.total || 0,
  };
}
