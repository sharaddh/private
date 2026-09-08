import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Prescription } from "../models/prescription";
import { Payment } from "../models/payment";
import { prisma, type Prisma } from "../db/prisma";
import { paginateFind, parseDateRange, prismaDateRange } from "../utils/pagination";
import { requireBranchId } from "../utils/scope";
import { AppError } from "../middleware/errorHandler";
import { restoreStockForOrder, type OrderStockRef } from "./inventory.service";
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

interface OrderSummaryItem {
  id: string;
  customerId: string;
  visitId?: string;
  frame?: string | null;
  frameBrand?: string | null;
  frameModel?: string | null;
  frameColor?: string | null;
  framePrice?: number | null;
  lens?: string | null;
  lensBrand?: string | null;
  lensType?: string | null;
  lensIndex?: string | null;
  lensPrice?: number | null;
  coating?: string | null;
  coatingPrice?: number | null;
  accessories?: string[] | null;
  quantity?: number | null;
  status?: string | null;
  createdAt?: Date | null;
}

interface PrescriptionSummaryItem {
  id: string;
  customerId: string;
  visitId?: string;
  rightEye?: Prisma.JsonValue;
  leftEye?: Prisma.JsonValue;
  pd?: string | null;
  notes?: string | null;
  createdAt?: Date | null;
}

interface CustomerSummary extends CustomerResult {
  visitCount: number;
  orderCount: number;
  totalBilled: number;
  lastOrder: OrderSummaryItem | null;
  lastPrescription: PrescriptionSummaryItem | null;
  recentOrders: OrderSummaryItem[];
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

  await prisma.$transaction(async (tx) => {
    // Restore stock for this customer's orders before deleting them, mirroring
    // deleteOrder so inventory isn't permanently lost.
    const orders = await tx.order.findMany({
      where: { customerId: id },
      include: { stockItems: true },
    });
    for (const order of orders) {
      await restoreStockForOrder(order as OrderStockRef, tx as any);
    }

    // Children first, deepest relations first (all RESTRICT, no cascade):
    // bills -> items/stock items, orders -> stock items, then grandchildren.
    const bills = await tx.bill.findMany({ where: { customerId: id }, select: { id: true } });
    if (bills.length) {
      const billIds = bills.map((b) => b.id);
      await tx.billItem.deleteMany({ where: { billId: { in: billIds } } });
      await tx.billStockItem.deleteMany({ where: { billId: { in: billIds } } });
    }

    const orderIds = orders.map((o) => o.id);
    if (orderIds.length) {
      await tx.orderStockItem.deleteMany({ where: { orderId: { in: orderIds } } });
      // deliveries reference orderId as SET NULL, but delete them explicitly too
      await tx.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
    }

    await tx.bill.deleteMany({ where: { customerId: id } });
    await tx.order.deleteMany({ where: { customerId: id } });
    await tx.prescription.deleteMany({ where: { customerId: id } });
    await tx.payment.deleteMany({ where: { customerId: id } });
    await tx.delivery.deleteMany({ where: { customerId: id } });
    await tx.visit.deleteMany({ where: { customerId: id } });

    await tx.customer.delete({ where: { id } });
  });
}

export async function getCustomerSummary(id: string): Promise<CustomerSummary> {
  const customer = await Customer.findUnique({ where: { id } });
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  const [visitCount, orderCount, billAgg, lastOrder, lastPrescription, recentOrders] =
    await Promise.all([
      Visit.count({ where: { customerId: id } }),
      Order.count({ where: { customerId: id } }),
      Bill.aggregate({
        where: { customerId: id },
        _sum: { totalAmount: true },
      }),
      Order.findFirst({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
      Prescription.findFirst({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
      Order.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  return {
    ...(customer as CustomerResult),
    visitCount,
    orderCount,
    totalBilled: billAgg._sum?.totalAmount ?? 0,
    lastOrder: (lastOrder as OrderSummaryItem) ?? null,
    lastPrescription: (lastPrescription as PrescriptionSummaryItem) ?? null,
    recentOrders: (recentOrders as OrderSummaryItem[] | null) ?? [],
  };
}
