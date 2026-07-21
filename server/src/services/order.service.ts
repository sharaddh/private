import mongoose from "mongoose";
import { Order } from "../models/order";
import { Customer } from "../models/customer";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { paginateQuery, parseDateRange, buildDateFilter } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import {
  VALID_TRANSITIONS,
  VALID_CLASSIFICATIONS,
} from "../types";
import type { PaginatedResult, OrderStatus } from "../types";

interface CreateOrderData {
  customerId: string;
  visitId?: string;
  frame?: string;
  frameBrand?: string;
  frameModel?: string;
  frameColor?: string;
  frameSize?: string;
  framePrice?: number;
  lens?: string;
  lensBrand?: string;
  lensType?: string;
  lensIndex?: string;
  lensPrice?: number;
  coating?: string;
  coatingPrice?: number;
  accessories?: string[];
  quantity?: number;
  deliveryDate?: string;
  status?: string;
}

interface UpdateOrderData {
  customerId?: string;
  visitId?: string;
  frame?: string;
  frameBrand?: string;
  frameModel?: string;
  frameColor?: string;
  frameSize?: string;
  framePrice?: number;
  lens?: string;
  lensBrand?: string;
  lensType?: string;
  lensIndex?: string;
  lensPrice?: number;
  coating?: string;
  coatingPrice?: number;
  accessories?: string[];
  quantity?: number;
  deliveryDate?: string;
  status?: string;
  classification?: string;
  rightLensStatus?: string;
  leftLensStatus?: string;
  reviewed?: boolean;
  forwardedCount?: number;
}

interface StatusUpdateData {
  status: string;
  collectPayment?: number;
  paymentMode?: string;
  advanceQuantity?: number;
}

interface OrderFilters {
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  dateField?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

interface OrderResult {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  visitId?: mongoose.Types.ObjectId;
  frame?: string;
  frameBrand?: string;
  frameModel?: string;
  frameColor?: string;
  frameSize?: string;
  framePrice: number;
  lens?: string;
  lensBrand?: string;
  lensType?: string;
  lensIndex?: string;
  lensPrice: number;
  coating?: string;
  coatingPrice: number;
  accessories: string[];
  quantity: number;
  forwardedCount: number;
  deliveryDate?: Date;
  actualDeliveryDate?: Date;
  status: OrderStatus;
  labAssigned?: string;
  labExpectedDate?: Date;
  labRemarks?: string;
  reviewed: boolean;
  classification: string;
  rightLensStatus: string;
  leftLensStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StatusUpdateResult {
  order: OrderResult;
  partial: boolean;
  forwardedCount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delivery?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payment?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bill?: Record<string, any> | null;
}

export async function createOrder(data: CreateOrderData): Promise<OrderResult> {
  if (!data.customerId) {
    throw new AppError(400, "Customer ID is required");
  }

  const customer = await Customer.findById(data.customerId).lean();
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  const order = new Order({
    customerId: data.customerId,
    visitId: data.visitId,
    frame: data.frame,
    frameBrand: data.frameBrand,
    frameModel: data.frameModel,
    frameColor: data.frameColor,
    frameSize: data.frameSize,
    framePrice: data.framePrice || 0,
    lens: data.lens,
    lensBrand: data.lensBrand,
    lensType: data.lensType,
    lensIndex: data.lensIndex,
    lensPrice: data.lensPrice || 0,
    coating: data.coating,
    coatingPrice: data.coatingPrice || 0,
    accessories: data.accessories || [],
    quantity: data.quantity || 1,
    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
    status: data.status || "Draft",
  });

  await order.save();
  return order.toObject() as unknown as OrderResult;
}

const UPDATE_WHITELIST = [
  "customerId",
  "visitId",
  "frame",
  "frameBrand",
  "frameModel",
  "frameColor",
  "frameSize",
  "framePrice",
  "lens",
  "lensBrand",
  "lensType",
  "lensIndex",
  "lensPrice",
  "coating",
  "coatingPrice",
  "accessories",
  "quantity",
  "deliveryDate",
  "status",
  "classification",
  "rightLensStatus",
  "leftLensStatus",
  "reviewed",
  "forwardedCount",
] as const;

export async function updateOrder(
  orderId: string,
  updates: UpdateOrderData
): Promise<OrderResult> {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in updates) {
      filtered[key] = (updates as Record<string, unknown>)[key];
    }
  }
  const order = await (Order as mongoose.Model<unknown>).findByIdAndUpdate(
    orderId,
    { $set: filtered },
    { new: true, runValidators: true }
  );
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order.toObject() as unknown as OrderResult;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const order = await Order.findByIdAndDelete(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }
}

export async function getOrderById(orderId: string): Promise<OrderResult> {
  const order = await Order.findById(orderId)
    .populate("customerId", "name mobile customerId")
    .lean();
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order as unknown as OrderResult;
}

export async function listOrders(
  filters: OrderFilters
): Promise<PaginatedResult<OrderResult>> {
  const filter: Record<string, unknown> = {};

  if (filters.customerId) {
    filter.customerId = filters.customerId;
  }
  if (filters.status) {
    filter.status = filters.status;
  }

  const dateField = filters.dateField || "createdAt";
  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateFilter = buildDateFilter(dateField, start, end);
  if (dateFilter) {
    Object.assign(filter, dateFilter);
  }

  const query = Order.find(filter)
    .populate("customerId", "name mobile")
    .sort({ createdAt: -1 });

  const result = await paginateQuery(query as never, {
    page: filters.page,
    limit: filters.limit,
    cursor: filters.cursor,
  }) as unknown as PaginatedResult<OrderResult>;

  // Batch-fetch bill per order via visitId (avoids N+1)
  const orderVisitIds: { orderId: string; visitId: string }[] = result.data
    .map((o: OrderResult) => {
      const oId = String((o as any)._id);
      const vId = o.visitId ? String(o.visitId) : null;
      return vId ? { orderId: oId, visitId: vId } : null;
    })
    .filter(Boolean) as { orderId: string; visitId: string }[];

  if (orderVisitIds.length > 0) {
    const uniqueVisitIds = [...new Set(orderVisitIds.map((v) => v.visitId))];
    const bills = await Bill.find({
      visitId: { $in: uniqueVisitIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).sort({ createdAt: -1 }).lean();

    const billByVisit = new Map(
      bills.map((b: any) => [String(b.visitId), b])
    );

    result.data = result.data.map((o: OrderResult) => {
      const vId = o.visitId ? String(o.visitId) : null;
      const billInfo = vId ? billByVisit.get(vId) || null : null;
      return { ...o, billInfo } as unknown as OrderResult;
    });
  }

  return result;
}

export async function updateOrderStatus(
  orderId: string,
  statusData: StatusUpdateData
): Promise<StatusUpdateResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (Order as any).findById(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(statusData.status)) {
    throw new AppError(
      400,
      `Cannot transition from "${order.status}" to "${statusData.status}". Allowed: ${allowed.join(", ") || "none"}`
    );
  }

  const qty = order.quantity || 1;
  const advQty = statusData.advanceQuantity ?? qty;
  const currentForwarded = order.forwardedCount || 0;
  const newForwarded = currentForwarded + advQty;

  if (newForwarded >= qty) {
    order.status = statusData.status;
    order.forwardedCount = 0;
    if (statusData.status === "Delivered") {
      order.actualDeliveryDate = new Date();
    }
  } else {
    order.forwardedCount = newForwarded;
  }
  await order.save();

  const result: StatusUpdateResult = {
    order: order.toObject() as unknown as OrderResult,
    partial: newForwarded < qty,
    forwardedCount: newForwarded < qty ? newForwarded : 0,
  };

  // Auto-update delivery (only on full transition)
  if (newForwarded >= qty) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivery = await (Delivery as any).findOne({ orderId: order._id });
    if (delivery) {
      if (statusData.status === "Ready") {
        delivery.status = "Ready";
        await delivery.save();
      } else if (statusData.status === "Delivered") {
        delivery.status = "Delivered";
        delivery.actualDeliveryDate = new Date();
        await delivery.save();
      } else if (statusData.status === "Cancelled") {
        delivery.status = "Cancelled";
        await delivery.save();
      }
      result.delivery = delivery.toObject();
    }
  }

  // Handle due collection on delivery (full transition only)
  if (
    statusData.status === "Delivered" &&
    newForwarded >= qty &&
    statusData.collectPayment &&
    statusData.collectPayment > 0
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bill = await (Bill as any).findOne({ visitId: order.visitId || order._id });
    if (!bill) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bill = await (Bill as any).findOne({ customerId: order.customerId }).sort({
        createdAt: -1,
      });
    }
    if (bill && bill.pendingAmount > 0) {
      const payment = await Payment.create({
        customerId: order.customerId,
        billId: bill._id,
        amount: statusData.collectPayment,
        paymentMode: statusData.paymentMode || "Cash",
        paymentDate: new Date(),
        notes: `Collected on delivery (order ${order._id})`,
      });

      bill.advancePaid = (bill.advancePaid || 0) + statusData.collectPayment;
      bill.pendingAmount = Math.max(
        0,
        (bill.totalAmount || 0) - bill.advancePaid
      );
      await bill.save();

      await Customer.findByIdAndUpdate(order.customerId, {
        $inc: { pendingAmount: -statusData.collectPayment },
      });

      result.payment = payment.toObject();
      result.bill = bill.toObject();
    }
  }

  return result;
}

export async function setClassification(
  orderId: string,
  classification: string
): Promise<OrderResult> {
  if (!(VALID_CLASSIFICATIONS as readonly string[]).includes(classification)) {
    throw new AppError(400, "Invalid classification");
  }

  const order = await (Order as mongoose.Model<unknown>).findByIdAndUpdate(
    orderId,
    { $set: { classification } },
    { new: true }
  );
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order.toObject() as unknown as OrderResult;
}

export async function setEyeClassification(
  orderId: string,
  eye: "right" | "left",
  status: string
): Promise<OrderResult> {
  if (!["right", "left"].includes(eye)) {
    throw new AppError(400, 'eye must be "right" or "left"');
  }
  if (!(VALID_CLASSIFICATIONS as readonly string[]).includes(status)) {
    throw new AppError(400, "Invalid status");
  }

  const field = eye === "right" ? "rightLensStatus" : "leftLensStatus";
  const order = await (Order as mongoose.Model<unknown>).findByIdAndUpdate(
    orderId,
    { $set: { [field]: status } },
    { new: true }
  );
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order.toObject() as unknown as OrderResult;
}

export async function setReviewed(
  orderId: string,
  reviewed: boolean
): Promise<OrderResult> {
  const order = await (Order as mongoose.Model<unknown>).findByIdAndUpdate(
    orderId,
    { $set: { reviewed } },
    { new: true }
  );
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order.toObject() as unknown as OrderResult;
}
