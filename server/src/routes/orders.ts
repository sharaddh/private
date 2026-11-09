import { Router } from "express";
import { prisma } from "../db/prisma";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Delivery } from "../models/delivery";
import { Customer } from "../models/customer";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { requireBranchId } from "../utils/scope";
import { VALID_TRANSITIONS } from "../types";
import { enqueueEventSafely, orderStatusEvent } from "../whatsapp/events";
import { paymentEventType } from "../whatsapp/events";
import { cancelRemindersForBill } from "../whatsapp/reminders";
import {
  createOrderSchema,
  updateOrderSchema,
  statusUpdateSchema,
  classifyOrderSchema,
  classifyEyeSchema,
  collectPaymentSchema,
} from "../validators/order.validator";
import {
  normalizeSplits,
  recordPayments,
  type PaymentSplit,
} from "../services/paymentSplits";
import * as orderController from "../controllers/orderController";

const router = Router();

router.get("/", authenticate, cacheRoute(30), asyncHandler(orderController.list));

router.get(
  "/status-counts",
  authenticate,
  cacheRoute(30),
  asyncHandler(orderController.statusCounts)
);

router.post(
  "/",
  authenticate,
  audit,
  validate(createOrderSchema, "body"),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findUnique({ where: { id: req.body.customerId } });
    if (!customer) throw new AppError(404, "Customer not found");
    await orderController.create(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.get("/:id", authenticate, asyncHandler(orderController.getById));

router.put(
  "/:id",
  authenticate,
  audit,
  validate(updateOrderSchema, "body"),
  asyncHandler(async (req, res) => {
    await orderController.update(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.patch(
  "/:id/classify",
  authenticate,
  validate(classifyOrderSchema, "body"),
  asyncHandler(async (req, res) => {
    await orderController.setClassification(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.patch(
  "/:id/classify-eye",
  authenticate,
  validate(classifyEyeSchema, "body"),
  asyncHandler(async (req, res) => {
    await orderController.setEyeClassification(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.patch(
  "/:id/review",
  authenticate,
  asyncHandler(async (req, res) => {
    await orderController.setReviewed(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

router.patch(
  "/:id/status",
  authenticate,
  validate(statusUpdateSchema, "body"),
  async (req, res) => {
    try {
      const { status, collectPayment, paymentMode, splits, advanceQuantity } =
        statusUpdateSchema.parse(req.body);
      const order = await Order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      const allowed = VALID_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
        });
      }

      const qty = order.quantity || 1;
      const advQty = advanceQuantity ?? qty;
      const currentForwarded = order.forwardedCount || 0;
      const newForwarded = currentForwarded + advQty;

      const updateData: Record<string, unknown> = {};
      if (newForwarded >= qty) {
        updateData.status = status;
        updateData.forwardedCount = 0;
        if (status === "Delivered") updateData.actualDeliveryDate = new Date();
      } else {
        updateData.forwardedCount = newForwarded;
      }
      const updatedOrder = await Order.update({ where: { id: order.id }, data: updateData });
      if (updatedOrder.status !== order.status) {
        const eventType = orderStatusEvent(updatedOrder.status);
        if (eventType) {
          await enqueueEventSafely({
            eventType,
            entityType: "order",
            entityId: updatedOrder.id,
            customerId: updatedOrder.customerId,
            branchId: updatedOrder.branchId,
            payload: { fromStatus: order.status, toStatus: updatedOrder.status },
          });
        }
      }

      const result: any = {
        order: updatedOrder,
        partial: newForwarded < qty,
        forwardedCount: newForwarded < qty ? newForwarded : 0,
      };

      const delivery = await Delivery.findFirst({ where: { orderId: order.id } });
      if (delivery && newForwarded >= qty) {
        const deliveryData: Record<string, unknown> = {};
        if (status === "Ready") {
          deliveryData.status = "Ready";
        } else if (status === "Delivered") {
          deliveryData.status = "Delivered";
          deliveryData.actualDeliveryDate = new Date();
        } else if (status === "Cancelled") {
          deliveryData.status = "Cancelled";
        }
        if (Object.keys(deliveryData).length > 0) {
          await Delivery.update({ where: { id: delivery.id }, data: deliveryData });
          result.delivery = { ...delivery, ...deliveryData };
        }
      }

      if (status === "Delivered" && newForwarded >= qty && collectPayment && collectPayment > 0) {
        let bill = await Bill.findFirst({ where: { visitId: order.visitId || order.id } });
        if (!bill) {
          bill = await Bill.findFirst({
            where: { customerId: order.customerId },
            orderBy: { createdAt: "desc" },
          });
        }
        if (bill && bill.pendingAmount > 0) {
          const targetBill = bill;
          const normalized = normalizeSplits({ collectPayment, paymentMode, splits });
          let rows: PaymentSplit[];
          if (normalized.usedSplits) {
            if (normalized.total > targetBill.pendingAmount) {
              throw new AppError(
                400,
                `Collected â‚¹${normalized.total} but only â‚¹${targetBill.pendingAmount} is pending on this bill`
              );
            }
            rows = normalized.rows;
          } else {
            // Unchanged legacy behaviour: unlike the other collection sites, this
            // one has never capped the amount against the pending balance.
            const collected = normalized.total || collectPayment;
            rows = normalized.rows.map((row) => ({ ...row, amount: collected }));
          }

          const collected = rows.reduce((sum, row) => sum + row.amount, 0);
          const newAdvancePaid = (targetBill.advancePaid || 0) + collected;
          const newPendingAmount = Math.max(0, (targetBill.totalAmount || 0) - newAdvancePaid);

          // Payment, bill and customer move together: a failure part-way used to
          // leave a payment row against an unreduced balance.
          const { payments } = await prisma.$transaction(async (tx) => {
            const written = await recordPayments(tx, {
              customerId: order.customerId,
              billId: targetBill.id,
              rows,
              notes: `Collected on delivery (order ${order.id})`,
              branchId: requireBranchId(),
            });
            await tx.bill.update({
              where: { id: targetBill.id },
              data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
            });
            await tx.customer.update({
              where: { id: order.customerId },
              data: { pendingAmount: { decrement: collected } },
            });
            return written;
          });

          result.payment = payments[0];
          result.payments = payments;
          result.bill = {
            ...targetBill,
            advancePaid: newAdvancePaid,
            pendingAmount: newPendingAmount,
          };

          if (newPendingAmount <= 0) {
            await cancelRemindersForBill(targetBill.id, "bill_settled");
          }
          const statusPayment = payments[0] as { id?: string } | undefined;
          if (statusPayment?.id) {
            await enqueueEventSafely({
              eventType: paymentEventType(newPendingAmount),
              entityType: "payment",
              entityId: statusPayment.id,
              customerId: order.customerId,
              branchId: order.branchId,
              payload: {
                billId: targetBill.id,
                paymentId: statusPayment.id,
                amount: collected,
              },
            });
          }
        }
      }

      // Invalidate before responding so the client's immediate refetch never sees stale data
      await invalidateCache("/api/orders");
      await invalidateCache("/api/dashboard");
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  "/:id/collect-payment",
  authenticate,
  validate(collectPaymentSchema, "body"),
  async (req, res) => {
    try {
      const { collectPayment, paymentMode, splits } = req.body;
      if (!collectPayment || collectPayment <= 0) {
        return res.status(400).json({ success: false, message: "Invalid payment amount" });
      }

      const order = await Order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      let bill = await Bill.findFirst({ where: { visitId: order.visitId || order.id } });
      if (!bill) {
        bill = await Bill.findFirst({
          where: { customerId: order.customerId },
          orderBy: { createdAt: "desc" },
        });
      }
      if (!bill) {
        return res.status(404).json({ success: false, message: "No bill found for this order" });
      }
      if (bill.pendingAmount <= 0) {
        return res.status(400).json({ success: false, message: "No pending amount on this bill" });
      }

      const normalized = normalizeSplits({ collectPayment, paymentMode, splits });
      const targetBill = bill;
      let rows: PaymentSplit[];
      if (normalized.usedSplits) {
        if (normalized.total > targetBill.pendingAmount) {
          throw new AppError(
            400,
            `Collected â‚¹${normalized.total} but only â‚¹${targetBill.pendingAmount} is pending on this bill`
          );
        }
        rows = normalized.rows;
      } else {
        // Unchanged legacy behaviour: the silent Math.min cap.
        const actualCollect = Math.min(collectPayment, targetBill.pendingAmount);
        rows = normalized.rows.map((row) => ({ ...row, amount: actualCollect }));
      }

      const collected = rows.reduce((sum, row) => sum + row.amount, 0);
      const newAdvancePaid = (targetBill.advancePaid || 0) + collected;
      const newPendingAmount = Math.max(0, (targetBill.totalAmount || 0) - newAdvancePaid);

      // Payment, bill and customer move together: a failure part-way used to
      // leave a payment row against an unreduced balance.
      const { payments } = await prisma.$transaction(async (tx) => {
        const written = await recordPayments(tx, {
          customerId: order.customerId,
          billId: targetBill.id,
          rows,
          notes: `Collected after delivery (order ${order.id})`,
          branchId: requireBranchId(),
        });
        await tx.bill.update({
          where: { id: targetBill.id },
          data: { advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
        });
        await tx.customer.update({
          where: { id: order.customerId },
          data: { pendingAmount: { decrement: collected } },
        });
        return written;
      });

      if (newPendingAmount <= 0) {
        await cancelRemindersForBill(targetBill.id, "bill_settled");
      }
      const collectPaymentRow = payments[0] as { id?: string } | undefined;
      if (collectPaymentRow?.id) {
        await enqueueEventSafely({
          eventType: paymentEventType(newPendingAmount),
          entityType: "payment",
          entityId: collectPaymentRow.id,
          customerId: order.customerId,
          branchId: order.branchId,
          payload: {
            billId: targetBill.id,
            paymentId: collectPaymentRow.id,
            amount: collected,
          },
        });
      }

      invalidateCache("/api/orders");
      invalidateCache("/api/dashboard");

      res.json({
        success: true,
        data: {
          payment: payments[0],
          payments,
          bill: { ...bill, advancePaid: newAdvancePaid, pendingAmount: newPendingAmount },
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  audit,
  asyncHandler(async (req, res) => {
    await orderController.remove(req, res);
    invalidateCache("/api/orders");
    invalidateCache("/api/dashboard");
  })
);

export default router;
