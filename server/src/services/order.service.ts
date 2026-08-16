import { Order } from "../models/order";
import { Customer } from "../models/customer";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { Prescription } from "../models/prescription";
import { paginateFind, parseDateRange, prismaDateRange } from "../utils/pagination";
import { requireBranchId } from "../utils/scope";
import { AppError } from "../middleware/errorHandler";
import {
  decrementStockForOrder,
  restoreStockForOrder,
  assertStockAvailable,
} from "./inventory.service";
import { VALID_TRANSITIONS, VALID_CLASSIFICATIONS } from "../types";
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
  id: string;
  customerId: string;
  visitId?: string | null;
  frame?: string | null;
  frameBrand?: string | null;
  frameModel?: string | null;
  frameColor?: string | null;
  frameSize?: string | null;
  framePrice: number;
  lens?: string | null;
  lensBrand?: string | null;
  lensType?: string | null;
  lensIndex?: string | null;
  lensPrice: number;
  coating?: string | null;
  coatingPrice: number;
  accessories: string[];
  quantity: number;
  forwardedCount: number;
  deliveryDate?: Date | null;
  actualDeliveryDate?: Date | null;
  status: OrderStatus;
  labAssigned?: string | null;
  labExpectedDate?: Date | null;
  labRemarks?: string | null;
  reviewed: boolean;
  classification: string;
  rightLensStatus: string;
  leftLensStatus: string;

  prescription?: Record<string, any> | null;

  billInfo?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StatusUpdateResult {
  order: OrderResult;
  partial: boolean;
  forwardedCount: number;

  delivery?: Record<string, any> | null;

  payment?: Record<string, any> | null;

  bill?: Record<string, any> | null;
}

export async function createOrder(data: CreateOrderData): Promise<OrderResult> {
  if (!data.customerId) {
    throw new AppError(400, "Customer ID is required");
  }

  const customer = await Customer.findUnique({ where: { id: data.customerId } });
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  await assertStockAvailable(data);

  const order = await Order.create({
    data: {
      customerId: data.customerId,
      visitId: data.visitId ?? null,
      frame: data.frame ?? null,
      frameBrand: data.frameBrand ?? null,
      frameModel: data.frameModel ?? null,
      frameColor: data.frameColor ?? null,
      frameSize: data.frameSize ?? null,
      framePrice: data.framePrice || 0,
      lens: data.lens ?? null,
      lensBrand: data.lensBrand ?? null,
      lensType: data.lensType ?? null,
      lensIndex: data.lensIndex ?? null,
      lensPrice: data.lensPrice || 0,
      coating: data.coating ?? null,
      coatingPrice: data.coatingPrice || 0,
      accessories: data.accessories || [],
      quantity: data.quantity || 1,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      status: (data.status || "Draft") as any,
      branchId: requireBranchId(),
    },
  });

  await decrementStockForOrder(order);
  return order as unknown as OrderResult;
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

export async function updateOrder(orderId: string, updates: UpdateOrderData): Promise<OrderResult> {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in updates) {
      filtered[key] = (updates as Record<string, unknown>)[key];
    }
  }
  const existing = await Order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new AppError(404, "Order not found");
  }
  const order = await Order.update({ where: { id: orderId }, data: filtered as any });
  return order as unknown as OrderResult;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const order = await Order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  await restoreStockForOrder(order);
  await Order.delete({ where: { id: orderId } });
}

export async function getOrderById(orderId: string): Promise<OrderResult> {
  const order = await Order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { name: true, mobile: true, customerId: true } } },
  });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order as unknown as OrderResult;
}

export async function listOrders(filters: OrderFilters): Promise<PaginatedResult<OrderResult>> {
  const where: Record<string, unknown> = {};

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.status) {
    const statuses = String(filters.status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    where.status = statuses.length > 1 ? { in: statuses as any[] } : { equals: statuses[0] as any };
  }

  const { start, end } = parseDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const dateRange = prismaDateRange(filters.dateField || "createdAt", start, end);
  if (dateRange) {
    Object.assign(where, dateRange);
  }

  const result = await paginateFind(
    (args) =>
      Order.findMany({
        ...args,
        include: { customer: { select: { name: true, mobile: true } } },
        orderBy: { createdAt: "desc" },
      }),
    (w) => Order.count({ where: w }),
    { page: filters.page, limit: filters.limit, cursor: filters.cursor },
    { where, orderBy: { createdAt: "desc" } },
  ) as unknown as PaginatedResult<OrderResult>;

  const orderVisitIds: { orderId: string; visitId: string }[] = result.data
    .map((o: OrderResult) => {
      const oId = String(o.id);
      const vId = o.visitId ? String(o.visitId) : null;
      return vId ? { orderId: oId, visitId: vId } : null;
    })
    .filter(Boolean) as { orderId: string; visitId: string }[];

  if (orderVisitIds.length > 0) {
    const uniqueVisitIds = [...new Set(orderVisitIds.map((v) => v.visitId))];

    // Batch-fetch prescriptions per visit (avoids N+1)
    const prescriptions = await Prescription.findMany({
      where: { visitId: { in: uniqueVisitIds } },
      orderBy: { createdAt: "desc" },
    });
    const rxByVisit = new Map(prescriptions.map((p: any) => [String(p.visitId), p]));

    // Batch-fetch bill per order via visitId (avoids N+1)
    const bills = await Bill.findMany({
      where: { visitId: { in: uniqueVisitIds } },
      orderBy: { createdAt: "desc" },
    });
    const billByVisit = new Map(bills.map((b: any) => [String(b.visitId), b]));

    result.data = result.data.map((o: OrderResult) => {
      const vId = o.visitId ? String(o.visitId) : null;
      const billInfo = vId ? billByVisit.get(vId) || null : null;
      const prescription = vId ? rxByVisit.get(vId) || null : null;
      return { ...o, billInfo, prescription } as unknown as OrderResult;
    });
  }

  return result;
}

export async function updateOrderStatus(
  orderId: string,
  statusData: StatusUpdateData
): Promise<StatusUpdateResult> {
  const order = await Order.findUnique({ where: { id: orderId } });
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

  const oldStatus = order.status;
  const updateData: Record<string, unknown> = {};
  if (newForwarded >= qty) {
    updateData.status = statusData.status;
    updateData.forwardedCount = 0;
    if (statusData.status === "Delivered") {
      updateData.actualDeliveryDate = new Date();
    }
  } else {
    updateData.forwardedCount = newForwarded;
  }
  const updatedOrder = await Order.update({ where: { id: orderId }, data: updateData as any });

  if (newForwarded >= qty) {
    if (statusData.status === "Cancelled" && oldStatus !== "Cancelled") {
      await restoreStockForOrder(updatedOrder);
    } else if (oldStatus === "Cancelled" && statusData.status !== "Cancelled") {
      await decrementStockForOrder(updatedOrder);
    }
  }

  const result: StatusUpdateResult = {
    order: updatedOrder as unknown as OrderResult,
    partial: newForwarded < qty,
    forwardedCount: newForwarded < qty ? newForwarded : 0,
  };

  // Auto-update delivery (only on full transition)
  if (newForwarded >= qty) {
    const delivery = await Delivery.findFirst({ where: { orderId: order.id } });
    if (delivery) {
      const deliveryUpdate: Record<string, unknown> = {};
      if (statusData.status === "Ready") {
        deliveryUpdate.status = "Ready";
      } else if (statusData.status === "Delivered") {
        deliveryUpdate.status = "Delivered";
        deliveryUpdate.actualDeliveryDate = new Date();
      } else if (statusData.status === "Cancelled") {
        deliveryUpdate.status = "Cancelled";
      }
      const updatedDelivery = await Delivery.update({
        where: { id: delivery.id },
        data: deliveryUpdate,
      });
      result.delivery = updatedDelivery;
    }
  }

  // Handle due collection on delivery (full transition only)
  if (
    statusData.status === "Delivered" &&
    newForwarded >= qty &&
    statusData.collectPayment &&
    statusData.collectPayment > 0
  ) {
    let bill = await Bill.findFirst({ where: { visitId: order.visitId || order.id } });
    if (!bill) {
      bill = await Bill.findFirst({
        where: { customerId: order.customerId },
        orderBy: { createdAt: "desc" },
      });
    }
    if (bill && bill.pendingAmount > 0) {
      const payment = await Payment.create({
        data: {
          customerId: order.customerId,
          billId: bill.id,
          amount: statusData.collectPayment,
          paymentMode: (statusData.paymentMode || "Cash") as any,
          paymentDate: new Date(),
          notes: `Collected on delivery (order ${order.id})`,
          branchId: requireBranchId(),
        },
      });

      const newAdvancePaid = (bill.advancePaid || 0) + statusData.collectPayment;
      const newPendingAmount = Math.max(0, (bill.totalAmount || 0) - newAdvancePaid);
      const updatedBill = await Bill.update({
        where: { id: bill.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
      });

      await Customer.update({
        where: { id: order.customerId },
        data: { pendingAmount: { decrement: statusData.collectPayment } },
      });

      result.payment = payment;
      result.bill = updatedBill;
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

  const existing = await Order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new AppError(404, "Order not found");
  }
  const order = await Order.update({ where: { id: orderId }, data: { classification } as any });
  return order as unknown as OrderResult;
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

  const existing = await Order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new AppError(404, "Order not found");
  }
  const field = eye === "right" ? "rightLensStatus" : "leftLensStatus";
  const order = await Order.update({
    where: { id: orderId },
    data: { [field]: status } as any,
  });
  return order as unknown as OrderResult;
}

export async function setReviewed(orderId: string, reviewed: boolean): Promise<OrderResult> {
  const existing = await Order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new AppError(404, "Order not found");
  }
  const order = await Order.update({ where: { id: orderId }, data: { reviewed } });
  return order as unknown as OrderResult;
}
