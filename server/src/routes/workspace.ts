import { Router } from "express";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Prescription } from "../models/prescription";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/asyncHandler";
import { invalidateCache } from "../middleware/cache";

const router = Router();

const transactionSchema = z.object({
  customerId: z.string().optional(),
  customer: z.object({
    _id: z.string().optional(),
    name: z.string().optional(),
    mobile: z.string().optional(),
    email: z.string().optional(),
    age: z.number().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  visit: z.object({
    visitDate: z.string().optional(),
    doctorName: z.string().optional(),
    shop: z.string().optional(),
    remarks: z.string().optional(),
  }).optional(),
  prescription: z.record(z.string(), z.unknown()).optional(),
  order: z.record(z.string(), z.unknown()).optional(),
  bill: z.object({
    items: z.array(z.unknown()).optional(),
    subtotal: z.number().optional(),
    discount: z.number().optional(),
    totalAmount: z.number().optional(),
  }).optional(),
  payment: z.object({
    amount: z.number().min(0).optional(),
    mode: z.string().optional(),
    paymentMode: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  delivery: z.object({
    address: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }).optional(),
});

router.post("/transaction", authenticate, asyncHandler(async (req, res) => {
  const body = transactionSchema.parse(req.body);
  const result: any = {};

  // Customer
  let customer: any = null;
  if (body.customerId) {
    customer = await Customer.findById(body.customerId);
  }
  if (!customer && body.customer?._id) {
    customer = await Customer.findById(body.customer._id);
  }
  if (!customer && body.customer?.mobile) {
    customer = await Customer.findOne({ mobile: body.customer.mobile });
  }
  if (!customer && body.customer) {
    customer = new Customer({
      ...body.customer,
      customerId: `CUST-${Date.now()}`,
    });
    await customer.save();
  }

  if (!customer) {
    return res.status(400).json({ success: false, message: "Customer not found or created" });
  }
  result.customer = customer;

  // Visit + Prescription
  if (body.visit) {
    const visit = new Visit({
      customerId: customer._id,
      visitDate: body.visit.visitDate ? new Date(body.visit.visitDate) : new Date(),
      doctorName: body.visit.doctorName,
      shop: body.visit.shop,
      remarks: body.visit.remarks,
    });
    await visit.save();
    result.visit = visit;
    await Customer.findByIdAndUpdate(customer._id, { $inc: { totalVisits: 1 } });

    if (body.prescription) {
      const prescription = new Prescription({
        customerId: customer._id,
        visitId: visit._id,
        ...body.prescription,
      });
      await prescription.save();
      result.prescription = prescription;
    }
  }

  // Order
  if (body.order) {
    const order = new Order({
      customerId: customer._id,
      visitId: result.visit?._id,
      ...body.order,
    });
    await order.save();
    result.order = order;
  }

  // Bill + Payment
  if (body.bill) {
    const bill = new Bill({
      billNumber: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: customer._id,
      visitId: result.visit?._id,
      items: body.bill.items || [],
      subtotal: body.bill.subtotal || 0,
      discount: body.bill.discount || 0,
      totalAmount: body.bill.totalAmount || 0,
      advancePaid: body.payment?.amount || 0,
      pendingAmount: Math.max(0, (body.bill.totalAmount || 0) - (body.payment?.amount || 0)),
    });
    await bill.save();
    result.bill = bill;

    const billTotalAmount = body.bill.totalAmount || 0;
    const billPendingAmount = Math.max(0, billTotalAmount - (body.payment?.amount || 0));
    if (billTotalAmount > 0) {
      await Customer.findByIdAndUpdate(customer._id, {
        $inc: { totalSpent: billTotalAmount, pendingAmount: billPendingAmount },
      });
    }

    if (body.payment?.amount != null && body.payment.amount > 0) {
      const payment = new Payment({
        customerId: customer._id,
        billId: bill._id,
        amount: body.payment.amount,
        paymentMode: body.payment.paymentMode || body.payment.mode || "Cash",
        paymentDate: new Date(),
        notes: body.payment.notes || "Advance payment",
      });
      await payment.save();
      result.payment = payment;
    }
  }

  // Delivery
  if (body.delivery) {
    const delivery = new Delivery({
      customerId: customer._id,
      orderId: result.order?._id,
      address: body.delivery.address,
      expectedDeliveryDate: body.delivery.expectedDeliveryDate ? new Date(body.delivery.expectedDeliveryDate) : undefined,
    });
    await delivery.save();
    result.delivery = delivery;
  }

  await Promise.all([
    invalidateCache("/api/customers"),
    invalidateCache("/api/visits"),
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);

  res.json({ success: true, data: result });
}));

export default router;
