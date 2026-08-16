import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Prescription } from "../models/prescription";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { paginateFind, parseDateRange, prismaDateRange } from "../utils/pagination";
import { requireBranchId } from "../utils/scope";
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
  id: string;
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

function generateCustomerId(): string {
  return `CUST-${Date.now()}`;
}

export async function listCustomers(
  filters: CustomerFilters
): Promise<PaginatedResult<CustomerResult>> {
  const where: Record<string, unknown> = {};

  if (filters.phone) {
    where.mobile = { contains: filters.phone, mode: "insensitive" };
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { mobile: { contains: s, mode: "insensitive" } },
      { customerId: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { alternateMobile: { contains: s, mode: "insensitive" } },
      { city: { contains: s, mode: "insensitive" } },
    ];
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateRange = prismaDateRange("createdAt", start, end);
  if (dateRange) {
    Object.assign(where, dateRange);
  }

  return paginateFind(
    (args) => Customer.findMany(args),
    (w) => Customer.count({ where: w }),
    {
      page: filters.page,
      limit: filters.limit,
      cursor: filters.cursor,
    },
    { where, orderBy: { createdAt: "desc" } }
  ) as Promise<PaginatedResult<CustomerResult>>;
}

export async function getCustomerById(id: string): Promise<CustomerResult> {
  const customer = await Customer.findUnique({ where: { id } });
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }
  return customer as CustomerResult;
}

export async function createCustomer(data: CreateCustomerData): Promise<CustomerResult> {
  if (!data.name?.trim()) {
    throw new AppError(400, "Name is required");
  }
  if (!data.mobile?.trim()) {
    throw new AppError(400, "Mobile is required");
  }

  const customer = await Customer.create({
    data: {
      ...data,
      customerId: generateCustomerId(),
      mobile: data.mobile.trim(),
      branchId: requireBranchId(),
    },
  });

  return customer as CustomerResult;
}

export async function updateCustomer(
  id: string,
  updates: UpdateCustomerData
): Promise<CustomerResult> {
  const existing = await Customer.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Customer not found");
  }

  const customer = await Customer.update({
    where: { id },
    data: updates,
  });

  return customer as CustomerResult;
}

export async function deleteCustomer(id: string): Promise<void> {
  const existing = await Customer.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Customer not found");
  }

  await Customer.delete({ where: { id } });

  await Promise.all([
    Visit.deleteMany({ where: { customerId: id } }),
    Order.deleteMany({ where: { customerId: id } }),
    Bill.deleteMany({ where: { customerId: id } }),
    Prescription.deleteMany({ where: { customerId: id } }),
    Payment.deleteMany({ where: { customerId: id } }),
    Delivery.deleteMany({ where: { customerId: id } }),
  ]);
}

export async function getCustomerSummary(id: string): Promise<CustomerSummary> {
  const customer = await Customer.findUnique({ where: { id } });
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  const [visitCount, orderCount, billAgg] = await Promise.all([
    Visit.count({ where: { customerId: id } }),
    Order.count({ where: { customerId: id } }),
    Bill.aggregate({
      where: { customerId: id },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    ...(customer as CustomerResult),
    visitCount,
    orderCount,
    totalBilled: billAgg._sum?.totalAmount ?? 0,
  };
}
