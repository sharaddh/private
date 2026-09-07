import { prisma } from "../db/prisma";
import { paginateFind, prismaDateRange, parseDateRange } from "../utils/pagination";
import { istDateKey } from "../utils/date";
import { requireBranchId } from "../utils/scope";
import { AppError } from "../middleware/errorHandler";
import { restoreStockForOrder, decrementStockForOrder } from "./inventory.service";
import type { PaginatedResult } from "../types";

interface BillItemInput {
  description: string;
  quantity?: number;
  unitPrice?: number;
}

interface CreateBillData {
  customerId: string;
  visitId?: string;
  items?: BillItemInput[];
  discount?: number;
  tax?: number;
  advancePaid?: number;
}

interface UpdateBillData {
  items?: BillItemInput[];
  discount?: number;
  tax?: number;
  advancePaid?: number;
  status?: string;
}

interface BillFilters {
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

interface BillResult {
  id: string;
  billNumber: string;
  customerId: string;
  visitId?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  stockItems?: Array<{ sku?: string; quantity?: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  advancePaid: number;
  pendingAmount: number;
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function calculateSubtotal(items: BillItemInput[]): number {
  return items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);
}

function calculateBillAmounts(
  items: BillItemInput[],
  discount: number,
  tax: number,
  advancePaid: number
): { subtotal: number; totalAmount: number; pendingAmount: number } {
  const subtotal = calculateSubtotal(items);
  const totalAmount = subtotal - discount + tax;
  const pendingAmount = Math.max(0, totalAmount - advancePaid);
  return { subtotal, totalAmount, pendingAmount };
}

const billInclude = {
  customer: { select: { id: true, name: true, mobile: true, customerId: true } },
  items: true,
  stockItems: true,
} as const;

export async function generateBillNumber(): Promise<string> {
  const datePart = istDateKey(new Date()).replace(/-/g, "");
  const prefix = `BILL-${datePart}-`;

  const count = await prisma.bill.count({
    where: { billNumber: { startsWith: prefix } },
  });

  const seqStr = String(count + 1).padStart(4, "0");
  return `${prefix}${seqStr}`;
}

const MAX_BILL_NUMBER_ATTEMPTS = 5;

export async function createBill(
  data: CreateBillData,
  customerId: string,
  visitId?: string
): Promise<BillResult> {
  if (!customerId) {
    throw new AppError(400, "Customer ID is required");
  }

  const resolvedVisitId = visitId || data.visitId;

  if (resolvedVisitId) {
    const existing = await prisma.bill.findFirst({
      where: { visitId: resolvedVisitId, status: { not: "Cancelled" } },
      include: billInclude,
    });
    if (existing) {
      return existing as unknown as BillResult;
    }
  }

  const items = data.items || [];
  const discount = data.discount || 0;
  const tax = data.tax || 0;
  const advancePaid = data.advancePaid || 0;

  const { subtotal, totalAmount, pendingAmount } = calculateBillAmounts(
    items,
    discount,
    tax,
    advancePaid
  );

  const branchId = requireBranchId();

  let bill: any = null;
  for (let attempt = 0; attempt < MAX_BILL_NUMBER_ATTEMPTS; attempt++) {
    const billNumber = await generateBillNumber();
    try {
      bill = await prisma.bill.create({
        data: {
          billNumber,
          customerId,
          visitId: resolvedVisitId,
          branchId,
          items: {
            create: items.map((it) => ({
              description: it.description,
              quantity: it.quantity || 1,
              unitPrice: it.unitPrice || 0,
              total: (it.quantity || 1) * (it.unitPrice || 0),
            })),
          },
          subtotal,
          discount,
          tax,
          advancePaid,
          pendingAmount,
          totalAmount,
          status: "Active",
        },
        include: billInclude,
      });
      break;
    } catch (err: any) {
      const isCollision = err && typeof err === "object" && err.code === "P2002";
      if (!isCollision || attempt === MAX_BILL_NUMBER_ATTEMPTS - 1) {
        throw err;
      }
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalSpent: { increment: totalAmount },
      pendingAmount: { increment: pendingAmount },
    },
  });

  return bill as unknown as BillResult;
}

export async function updateBill(billId: string, updates: UpdateBillData): Promise<BillResult> {
  const existing = await prisma.bill.findUnique({ where: { id: billId }, include: billInclude });
  if (!existing) {
    throw new AppError(404, "Bill not found");
  }

  const oldTotal = existing.totalAmount || 0;
  const oldPending = existing.pendingAmount || 0;
  const oldStatus = existing.status;

  const items =
    updates.items ||
    (existing.items as Array<{ description: string; quantity: number; unitPrice: number }>).map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    }));
  const discount = updates.discount !== undefined ? updates.discount : existing.discount;
  const tax = updates.tax !== undefined ? updates.tax : existing.tax;
  const advancePaid = updates.advancePaid !== undefined ? updates.advancePaid : existing.advancePaid;

  const { subtotal, totalAmount, pendingAmount } = calculateBillAmounts(
    items,
    discount,
    tax,
    advancePaid
  );

  const newStatus = updates.status || existing.status;

  if (oldStatus !== newStatus && existing.stockItems && existing.stockItems.length > 0) {
    if (newStatus === "Cancelled") {
      await restoreStockForOrder({ stockItems: existing.stockItems as Array<{ sku?: string; quantity?: number }> });
    } else if (oldStatus === "Cancelled") {
      await decrementStockForOrder({ stockItems: existing.stockItems as Array<{ sku?: string; quantity?: number }> });
    }
  }

  const billData: Record<string, unknown> = {
    discount,
    tax,
    advancePaid,
    subtotal,
    totalAmount,
    pendingAmount,
    status: newStatus,
  };

  if (updates.items) {
    const newItems = items.map((it: BillItemInput) => ({
      description: it.description,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      total: (it.quantity || 1) * (it.unitPrice || 0),
    }));
    await prisma.billItem.deleteMany({ where: { billId } });
    await prisma.billItem.createMany({ data: newItems.map((it) => ({ ...it, billId, branchId: existing.branchId })) });
  }

  const bill = await prisma.bill.update({
    where: { id: billId },
    data: billData,
    include: billInclude,
  });

  const totalDiff = totalAmount - oldTotal;
  const pendingDiff = pendingAmount - oldPending;

  const customerData: Record<string, unknown> = {};
  if (Math.abs(totalDiff) > 0.01) customerData.totalSpent = { increment: totalDiff };
  if (Math.abs(pendingDiff) > 0.01) customerData.pendingAmount = { increment: pendingDiff };

  if (Object.keys(customerData).length > 0) {
    await prisma.customer.update({ where: { id: bill.customerId }, data: customerData });
  }

  return bill as unknown as BillResult;
}

export async function collectBillPayment(
  billId: string,
  amount: number,
  paymentMode: string
): Promise<{ payment: unknown; bill: unknown }> {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) {
    throw new AppError(404, "Bill not found");
  }
  if (bill.pendingAmount <= 0) {
    throw new AppError(400, "No pending amount on this bill");
  }

  const actualCollect = Math.min(amount, bill.pendingAmount);

  const newAdvancePaid = (bill.advancePaid || 0) + actualCollect;
  const newPending = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);

  const { payment, bill: updatedBill } = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        customerId: bill.customerId,
        billId: bill.id,
        amount: actualCollect,
        paymentMode: paymentMode || "Cash",
        paymentDate: new Date(),
        notes: "Payment collected",
        branchId: requireBranchId(),
      },
    });
    const ub = await tx.bill.update({
      where: { id: billId },
      data: { advancePaid: newAdvancePaid, pendingAmount: newPending },
    });
    await tx.customer.update({
      where: { id: bill.customerId },
      data: { pendingAmount: { decrement: actualCollect } },
    });
    return { payment: p, bill: ub };
  });

  return { payment, bill: updatedBill };
}

export async function deleteBill(billId: string): Promise<void> {
  const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { stockItems: true } });
  if (!bill) {
    throw new AppError(404, "Bill not found");
  }

  if (Array.isArray(bill.stockItems) && (bill.stockItems as unknown as Array<{ sku?: string; quantity?: number }>).length > 0) {
    const stockItems = bill.stockItems as unknown as Array<{ sku?: string; quantity?: number }>;
    await restoreStockForOrder({ stockItems });
  }

  await prisma.bill.delete({ where: { id: billId } });

  await prisma.customer.update({
    where: { id: bill.customerId },
    data: {
      totalSpent: { decrement: bill.totalAmount || 0 },
      pendingAmount: { decrement: bill.pendingAmount || 0 },
    },
  });
}

export async function getBillById(billId: string): Promise<BillResult> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: billInclude,
  });
  if (!bill) {
    throw new AppError(404, "Bill not found");
  }
  return bill as unknown as BillResult;
}

export async function listBills(filters: BillFilters): Promise<PaginatedResult<BillResult>> {
  const where: Record<string, unknown> = {};

  if (filters.customerId) {
    where.customerId = filters.customerId;
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
    (args) => prisma.bill.findMany({ ...args, include: billInclude }),
    (w) => prisma.bill.count({ where: w }),
    { page: filters.page, limit: filters.limit, cursor: filters.cursor },
    { where, orderBy: { createdAt: "desc" } }
  ) as unknown as Promise<PaginatedResult<BillResult>>;
}
