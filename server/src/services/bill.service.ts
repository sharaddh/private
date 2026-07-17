import mongoose from "mongoose";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { withTransaction } from "../utils/transaction";
import { paginateQuery, parseDateRange, buildDateFilter } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
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
  _id: mongoose.Types.ObjectId;
  billNumber: string;
  customerId: mongoose.Types.ObjectId;
  visitId?: mongoose.Types.ObjectId;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
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

export async function generateBillNumber(): Promise<string> {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `BILL-${datePart}-`;

  const Counter = mongoose.connection.collection("counters");
  const result = await Counter.findOneAndUpdate(
    { _id: `billSequence-${datePart}` as unknown as mongoose.Types.ObjectId, datePrefix: datePart },
    {
      $inc: { seq: 1 },
      $setOnInsert: { datePrefix: datePart },
    },
    { upsert: true, returnDocument: "after" }
  );

  const seq = (result as unknown as { seq?: number })?.seq ?? 1;
  const seqStr = String(seq).padStart(4, "0");
  return `${prefix}${seqStr}`;
}

export async function createBill(
  data: CreateBillData,
  customerId: string,
  visitId?: string
): Promise<BillResult> {
  if (!customerId) {
    throw new AppError(400, "Customer ID is required");
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

  const billNumber = await generateBillNumber();

  const result = await withTransaction(async (session) => {
    const bill = await Bill.create(
      [
        {
          billNumber,
          customerId,
          visitId: visitId || data.visitId,
          items: items.map((it) => ({
            description: it.description,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            total: (it.quantity || 1) * (it.unitPrice || 0),
          })),
          subtotal,
          discount,
          tax,
          advancePaid,
          pendingAmount,
          totalAmount,
          status: "Active",
        },
      ],
      { session }
    );

    await Customer.findByIdAndUpdate(
      customerId,
      { $inc: { totalSpent: totalAmount, pendingAmount } },
      { session }
    );

    return bill[0];
  });

  return result as unknown as BillResult;
}

export async function updateBill(
  billId: string,
  updates: UpdateBillData
): Promise<BillResult> {
  const result = await withTransaction(async (session) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bill = await (Bill as any).findById(billId).session(session);
    if (!bill) {
      throw new AppError(404, "Bill not found");
    }

    const oldTotal = bill.totalAmount || 0;
    const oldPending = bill.pendingAmount || 0;

    const items = updates.items || bill.items.map((it: { description: string; quantity: number; unitPrice: number }) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    }));
    const discount = updates.discount !== undefined ? updates.discount : bill.discount;
    const tax = updates.tax !== undefined ? updates.tax : bill.tax;
    const advancePaid = updates.advancePaid !== undefined ? updates.advancePaid : bill.advancePaid;

    const { subtotal, totalAmount, pendingAmount } = calculateBillAmounts(
      items,
      discount,
      tax,
      advancePaid
    );

    if (updates.items) {
      bill.items = items.map((it: BillItemInput) => ({
        description: it.description,
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        total: (it.quantity || 1) * (it.unitPrice || 0),
      }));
    }
    if (updates.discount !== undefined) bill.discount = discount;
    if (updates.tax !== undefined) bill.tax = tax;
    if (updates.advancePaid !== undefined) bill.advancePaid = advancePaid;
    if (updates.status) bill.status = updates.status;

    bill.subtotal = subtotal;
    bill.totalAmount = totalAmount;
    bill.pendingAmount = pendingAmount;

    await bill.save({ session });

    const newTotal = totalAmount;
    const newPending = pendingAmount;
    const totalDiff = newTotal - oldTotal;
    const pendingDiff = newPending - oldPending;

    const customerUpdates: Record<string, number> = {};
    if (Math.abs(totalDiff) > 0.01) customerUpdates.totalSpent = totalDiff;
    if (Math.abs(pendingDiff) > 0.01) customerUpdates.pendingAmount = pendingDiff;

    if (Object.keys(customerUpdates).length > 0) {
      await Customer.findByIdAndUpdate(bill.customerId, { $inc: customerUpdates }, { session });
    }

    return bill;
  });

  return result as unknown as BillResult;
}

export async function deleteBill(billId: string): Promise<void> {
  await withTransaction(async (session) => {
    const bill = await Bill.findByIdAndDelete(billId).session(session);
    if (!bill) {
      throw new AppError(404, "Bill not found");
    }

    await Customer.findByIdAndUpdate(
      bill.customerId,
      {
        $inc: {
          totalSpent: -(bill.totalAmount || 0),
          pendingAmount: -(bill.pendingAmount || 0),
        },
      },
      { session }
    );
  });
}

export async function getBillById(billId: string): Promise<BillResult> {
  const bill = await Bill.findById(billId)
    .populate("customerId", "name mobile customerId")
    .lean();
  if (!bill) {
    throw new AppError(404, "Bill not found");
  }
  return bill as unknown as BillResult;
}

export async function listBills(
  filters: BillFilters
): Promise<PaginatedResult<BillResult>> {
  const filter: Record<string, unknown> = {};

  if (filters.customerId) {
    filter.customerId = filters.customerId;
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateFilter = buildDateFilter("createdAt", start, end);
  if (dateFilter) {
    Object.assign(filter, dateFilter);
  }

  const query = Bill.find(filter)
    .populate("customerId", "name mobile customerId")
    .sort({ createdAt: -1 });

  return paginateQuery(query as never, {
    page: filters.page,
    limit: filters.limit,
    cursor: filters.cursor,
  }) as unknown as Promise<PaginatedResult<BillResult>>;
}
