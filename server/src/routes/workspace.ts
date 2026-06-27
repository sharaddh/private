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
import { asyncHandler } from "../middleware/asyncHandler";
import { invalidateCache } from "../middleware/cache";

const router = Router();

const transactionSchema = z.object({
  customer: z.object({
    _id: z.string().optional(),
    name: z.string().min(1),
    mobile: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    age: z.number().optional(),
    gender: z.string().optional(),
  }),
  visit: z.object({
    doctorName: z.string().optional(),
    remarks: z.string().optional(),
  }).optional(),
  prescription: z.object({
    rightEye: z.any().optional(),
    leftEye: z.any().optional(),
    pd: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  order: z.object({
    frame: z.string().optional(),
    frameBrand: z.string().optional(),
    frameModel: z.string().optional(),
    frameColor: z.string().optional(),
    frameSize: z.string().optional(),
    framePrice: z.number().optional(),
    lens: z.string().optional(),
    lensBrand: z.string().optional(),
    lensType: z.string().optional(),
    lensIndex: z.string().optional(),
    lensPrice: z.number().optional(),
    coating: z.string().optional(),
    coatingPrice: z.number().optional(),
    accessories: z.array(z.string()).optional(),
    quantity: z.number().optional(),
    deliveryDate: z.string().optional(),
    status: z.string().optional(),
    labAssigned: z.string().optional(),
    labExpectedDate: z.string().optional(),
    labRemarks: z.string().optional(),
  }).optional(),
  bill: z.object({
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number().optional(),
      unitPrice: z.number().optional(),
    })),
    discount: z.number().optional(),
    tax: z.number().optional(),
    advancePaid: z.number().optional(),
  }).optional(),
  payment: z.object({
    amount: z.number(),
    paymentMode: z.string().optional(),
    notes: z.string().optional(),
    entries: z.array(z.object({
      amount: z.number(),
      mode: z.string().optional(),
      notes: z.string().optional(),
    })).optional(),
  }).optional(),
  delivery: z.object({
    address: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

router.post("/transaction", authenticate, asyncHandler(async (req, res) => {
    const body = transactionSchema.parse(req.body);
    const result: any = {};

    // 1. Find or create customer
    let customer;
    if (body.customer._id) {
      customer = await Customer.findById(body.customer._id);
      if (customer) {
        Object.assign(customer, body.customer);
        await customer.save();
      }
    }
    if (!customer) {
      const existing = body.customer.mobile
        ? await Customer.findOne({ mobile: body.customer.mobile })
        : null;
      if (existing) {
        customer = existing;
        Object.assign(customer, body.customer);
        await customer.save();
      } else {
        customer = new Customer({
          ...body.customer,
          customerId: `CUST-${Date.now()}`,
        });
        await customer.save();
      }
    }
    result.customer = customer;

    // 2. Create visit
    if (body.visit) {
      const visit = new Visit({
        customerId: customer._id,
        visitDate: new Date(),
        doctorName: body.visit.doctorName,
        remarks: body.visit.remarks,
      });
      await visit.save();
      customer.totalVisits = (customer.totalVisits || 0) + 1;
      await customer.save();
      result.visit = visit;
    }

    // 3. Create prescription
    if (body.prescription) {
      const presc = new Prescription({
        customerId: customer._id,
        visitId: result.visit?._id,
        rightEye: body.prescription.rightEye,
        leftEye: body.prescription.leftEye,
        pd: body.prescription.pd,
        notes: body.prescription.notes,
      });
      await presc.save();
      result.prescription = presc;
    }

    // 4. Create order
    if (body.order) {
      const order = new Order({
        customerId: customer._id,
        visitId: result.visit?._id,
        frame: body.order.frame,
        frameBrand: body.order.frameBrand,
        frameModel: body.order.frameModel,
        frameColor: body.order.frameColor,
        frameSize: body.order.frameSize,
        framePrice: body.order.framePrice || 0,
        lens: body.order.lens,
        lensBrand: body.order.lensBrand,
        lensType: body.order.lensType,
        lensIndex: body.order.lensIndex,
        lensPrice: body.order.lensPrice || 0,
        coating: body.order.coating,
        coatingPrice: body.order.coatingPrice || 0,
        accessories: body.order.accessories || [],
        quantity: body.order.quantity || 1,
        deliveryDate: body.order.deliveryDate ? new Date(body.order.deliveryDate) : undefined,
        status: body.order.status || "Draft",
        labAssigned: body.order.labAssigned,
        labExpectedDate: body.order.labExpectedDate ? new Date(body.order.labExpectedDate) : undefined,
        labRemarks: body.order.labRemarks,
      });
      await order.save();
      result.order = order;
    }

    // 5. Create bill
    if (body.bill) {
      const billNumber = `BILL-${Date.now()}`;
      const items = (body.bill.items || []).map((it) => ({
        ...it,
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        total: (it.quantity || 1) * (it.unitPrice || 0),
      }));
      const subtotal = items.reduce((s, it) => s + it.total, 0);
      const total = subtotal - (body.bill.discount || 0) + (body.bill.tax || 0);
      const bill = new Bill({
        billNumber,
        customerId: customer._id,
        visitId: result.visit?._id,
        items,
        subtotal,
        discount: body.bill.discount || 0,
        tax: body.bill.tax || 0,
        advancePaid: body.bill.advancePaid || 0,
        totalAmount: total,
        pendingAmount: total - (body.bill.advancePaid || 0),
      });
      await bill.save();
      customer.totalSpent = (customer.totalSpent || 0) + total;
      customer.pendingAmount = (customer.pendingAmount || 0) + bill.pendingAmount;
      await customer.save();
      result.bill = bill;
    }

    // 6. Create payment
    if (body.payment) {
      const visitNote = `Payment from visit - ₹${body.payment.amount}`;
      const notes = body.payment.notes
        ? (body.payment.notes.includes("Payment from visit") ? body.payment.notes : `${body.payment.notes} | ${visitNote}`)
        : visitNote;
      const payment = new Payment({
        customerId: customer._id,
        billId: result.bill?._id,
        amount: body.payment.amount,
        paymentMode: body.payment.paymentMode || "Cash",
        paymentDate: new Date(),
        notes,
      });
      await payment.save();
      if (result.bill) {
        result.bill.advancePaid = (result.bill.advancePaid || 0) + body.payment.amount;
        result.bill.pendingAmount = Math.max(0, (result.bill.totalAmount || 0) - result.bill.advancePaid);
        await result.bill.save();
        customer.pendingAmount = result.bill.pendingAmount;
        await customer.save();
      }
      result.payment = payment;
    }

    // 7. Create delivery
    if (body.delivery) {
      const delivery = new Delivery({
        customerId: customer._id,
        orderId: result.order?._id,
        address: body.delivery.address,
        expectedDeliveryDate: body.delivery.expectedDeliveryDate
          ? new Date(body.delivery.expectedDeliveryDate)
          : undefined,
        status: body.delivery.status || "Pending",
      });
      await delivery.save();
      result.delivery = delivery;
    }

    await Promise.all([
      invalidateCache("/api/dashboard"),
      invalidateCache("/api/customers"),
      invalidateCache("/api/orders"),
      invalidateCache("/api/bills"),
    ]);
    res.json({ success: true, data: result });
}));

export default router;
