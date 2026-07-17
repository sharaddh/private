import mongoose from "mongoose";
import { Payment } from "../models/payment";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { withTransaction } from "../utils/transaction";
import { paginateQuery, parseDateRange, buildDateFilter } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import type { PaginatedResult } from "../types";

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
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
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

  const result = await withTransaction(async (session) => {
    const payment = await Payment.create(
      [
        {
          customerId: data.customerId,
          billId: data.billId,
          amount: data.amount,
          paymentMode: data.paymentMode || "Cash",
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          notes: data.notes,
        },
      ],
      { session }
    );

    if (data.billId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bill = await (Bill as any).findById(data.billId).session(session);
      if (bill) {
        bill.advancePaid = (bill.advancePaid || 0) + data.amount;
        bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
        await bill.save({ session });
      }
    }

    await Customer.findByIdAndUpdate(
      data.customerId,
      { $inc: { pendingAmount: -data.amount } },
      { session }
    );

    return payment[0];
  });

  return result as unknown as PaymentResult;
}

export async function updatePayment(
  paymentId: string,
  updates: UpdatePaymentData
): Promise<PaymentResult> {
  const result = await withTransaction(async (session) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment = await (Payment as any).findById(paymentId).session(session);
    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    const oldAmount = payment.amount;
    const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
    const diff = newAmount - oldAmount;

    if (updates.amount !== undefined) payment.amount = newAmount;
    if (updates.paymentMode !== undefined) payment.paymentMode = updates.paymentMode;
    if (updates.paymentDate !== undefined) payment.paymentDate = new Date(updates.paymentDate);
    if (updates.notes !== undefined) payment.notes = updates.notes;

    if (Math.abs(diff) > 0.01) {
      const changeNote = `Amount changed from ₹${oldAmount.toFixed(0)} to ₹${newAmount.toFixed(0)}`;
      const existingNotes = payment.notes || "";
      payment.notes = existingNotes ? `${existingNotes} | ${changeNote}` : changeNote;
    }

    await payment.save({ session });

    if (payment.billId && Math.abs(diff) > 0.01) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bill = await (Bill as any).findById(payment.billId).session(session);
      if (bill) {
        bill.advancePaid = Math.max(0, (bill.advancePaid || 0) + diff);
        bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
        await bill.save({ session });
      }

      await Customer.findByIdAndUpdate(
        payment.customerId,
        { $inc: { pendingAmount: -diff } },
        { session }
      );
    }

    return payment;
  });

  return result as unknown as PaymentResult;
}

export async function deletePayment(paymentId: string): Promise<void> {
  await withTransaction(async (session) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment = await (Payment as any).findByIdAndDelete(paymentId).session(session);
    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    if (payment.billId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bill = await (Bill as any).findById(payment.billId).session(session);
      if (bill) {
        bill.advancePaid = Math.max(0, (bill.advancePaid || 0) - payment.amount);
        bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
        await bill.save({ session });
      }
    }

    await Customer.findByIdAndUpdate(
      payment.customerId,
      { $inc: { pendingAmount: payment.amount } },
      { session }
    );
  });
}

export async function listPayments(
  filters: PaymentFilters
): Promise<PaginatedResult<PaymentResult>> {
  const filter: Record<string, unknown> = {};

  if (filters.customerId) {
    filter.customerId = filters.customerId;
  }
  if (filters.billId) {
    filter.billId = filters.billId;
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateFilter = buildDateFilter("paymentDate", start, end);
  if (dateFilter) {
    Object.assign(filter, dateFilter);
  }

  const query = Payment.find(filter)
    .populate("customerId", "name mobile customerId")
    .sort({ paymentDate: -1 });

  return paginateQuery(query as never, {
    page: filters.page,
    limit: filters.limit,
    cursor: filters.cursor,
  }) as unknown as Promise<PaginatedResult<PaymentResult>>;
}
