import { Payment } from "../models/payment";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { paginateFind, prismaDateRange, parseDateRange } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import type { PaginatedResult } from "../types";
import type { Prisma } from "@prisma/client";

interface CreatePaymentData {
  customerId: string;
  billId?: string;
  amount: number;
  paymentMode?: string;
  paymentDate?: string;
  notes?: string;
}

interface UpdatePaymentData {
  amount?: number;
  paymentMode?: string;
  paymentDate?: string;
  notes?: string;
}

interface PaymentFilters {
  customerId?: string;
  billId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

interface PaymentResult {
  id: string;
  customerId: string;
  billId?: string;
  amount: number;
  paymentMode: string;
  paymentDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createPayment(data: CreatePaymentData): Promise<PaymentResult> {
  if (!data.customerId) {
    throw new AppError(400, "Customer ID is required");
  }
  if (!data.amount || data.amount <= 0) {
    throw new AppError(400, "Payment amount must be positive");
  }

  const payment = await Payment.create({
    data: {
      customerId: data.customerId,
      billId: data.billId,
      amount: data.amount,
      paymentMode: data.paymentMode || "Cash",
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      notes: data.notes,
    } as Prisma.PaymentUncheckedCreateInput,
  });

  if (data.billId) {
    const bill = await Bill.findUnique({ where: { id: data.billId } });
    if (bill) {
      const newAdvancePaid = (bill.advancePaid || 0) + data.amount;
      const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
      await Bill.update({
        where: { id: bill.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
      });
    }
  }

  await Customer.update({
    where: { id: data.customerId },
    data: { pendingAmount: { decrement: data.amount } },
  });

  return payment as unknown as PaymentResult;
}

export async function updatePayment(
  paymentId: string,
  updates: UpdatePaymentData
): Promise<PaymentResult> {
  const payment = await Payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  const oldAmount = payment.amount;
  const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
  const diff = newAmount - oldAmount;

  const updateData: Record<string, unknown> = {};
  if (updates.amount !== undefined) updateData.amount = newAmount;
  if (updates.paymentMode !== undefined) updateData.paymentMode = updates.paymentMode;
  if (updates.paymentDate !== undefined) updateData.paymentDate = new Date(updates.paymentDate);

  let notes = updates.notes !== undefined ? updates.notes : payment.notes;

  if (Math.abs(diff) > 0.01) {
    const changeNote = `Amount changed from ₹${oldAmount.toFixed(0)} to ₹${newAmount.toFixed(0)}`;
    const existingNotes = payment.notes || "";
    notes = existingNotes ? `${existingNotes} | ${changeNote}` : changeNote;
  }

  if (updates.notes !== undefined || Math.abs(diff) > 0.01) {
    updateData.notes = notes;
  }

  const updatedPayment = await Payment.update({
    where: { id: paymentId },
    data: updateData,
  });

  if (payment.billId && Math.abs(diff) > 0.01) {
    const bill = await Bill.findUnique({ where: { id: payment.billId } });
    if (bill) {
      const newAdvancePaid = Math.max(0, (bill.advancePaid || 0) + diff);
      const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
      await Bill.update({
        where: { id: bill.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
      });
    }

    await Customer.update({
      where: { id: payment.customerId },
      data: { pendingAmount: { decrement: diff } },
    });
  }

  return updatedPayment as unknown as PaymentResult;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const payment = await Payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  await Payment.delete({ where: { id: paymentId } });

  if (payment.billId) {
    const bill = await Bill.findUnique({ where: { id: payment.billId } });
    if (bill) {
      const newAdvancePaid = Math.max(0, (bill.advancePaid || 0) - payment.amount);
      const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
      await Bill.update({
        where: { id: bill.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
      });
    }
  }

  await Customer.update({
    where: { id: payment.customerId },
    data: { pendingAmount: { increment: payment.amount } },
  });
}

export async function listPayments(
  filters: PaymentFilters
): Promise<PaginatedResult<PaymentResult>> {
  const where: Record<string, unknown> = {};

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.billId) {
    where.billId = filters.billId;
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateRange = prismaDateRange("paymentDate", start, end);
  if (dateRange) {
    Object.assign(where, dateRange);
  }

  return paginateFind(
    (args) => Payment.findMany(args),
    (w) => Payment.count({ where: w }),
    { page: filters.page, limit: filters.limit, cursor: filters.cursor },
    {
      where,
      include: { customer: { select: { name: true, mobile: true, customerId: true } } },
      orderBy: { paymentDate: "desc" },
    }
  ) as Promise<PaginatedResult<PaymentResult>>;
}
