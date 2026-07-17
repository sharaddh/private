import mongoose from "mongoose";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Prescription } from "../models/prescription";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { Settings } from "../models/settings";
import { withTransaction } from "../utils/transaction";
import { AppError } from "../middleware/errorHandler";
import { generateBillPdf } from "../utils/pdf";
import { normalizePhone } from "../utils/phone";
import { logger } from "../utils/logger";

interface TransactionInput {
  customerId?: string;
  customer?: {
    _id?: string;
    name?: string;
    mobile?: string;
    email?: string;
    age?: number;
    gender?: string;
    address?: string;
    city?: string;
  };
  visit?: {
    visitDate?: string;
    visitType?: string;
    doctorName?: string;
    shop?: string;
    remarks?: string;
  };
  prescription?: Record<string, unknown>;
  order?: Record<string, unknown>;
  bill?: {
    items?: unknown[];
    subtotal?: number;
    discount?: number;
    totalAmount?: number;
  };
  payment?: {
    amount?: number;
    mode?: string;
    paymentMode?: string;
    notes?: string;
  };
  delivery?: {
    address?: string;
    expectedDeliveryDate?: string;
  };
}

export async function executeTransaction(
  body: TransactionInput,
  branchId?: string
): Promise<Record<string, unknown>> {
  return withTransaction(async (session) => {
    const result: Record<string, unknown> = {};

    let customer: InstanceType<typeof Customer> | null = null;
    if (body.customerId) {
      customer = await Customer.findById(body.customerId).session(session);
    }
    if (!customer && body.customer?._id) {
      customer = await Customer.findById(body.customer._id).session(session);
    }
    if (!customer && body.customer?.mobile) {
      customer = await Customer.findOne({ mobile: body.customer.mobile }).session(session);
    }
    if (!customer && body.customer) {
      customer = new Customer({
        ...body.customer,
        customerId: `CUST-${Date.now()}`,
      });
      await customer.save({ session });
    }

    if (!customer) {
      throw new AppError(400, "Customer not found or created");
    }
    result.customer = customer;

    if (body.visit) {
      const visit = new Visit({
        customerId: customer._id,
        visitDate: body.visit.visitDate ? new Date(body.visit.visitDate) : new Date(),
        visitType: body.visit.visitType || "new",
        doctorName: body.visit.doctorName,
        shop: body.visit.shop,
        remarks: body.visit.remarks,
      });
      await visit.save({ session });
      result.visit = visit;
      await Customer.findByIdAndUpdate(customer._id, { $inc: { totalVisits: 1 } }).session(session);

      if (body.prescription) {
        const prescription = new Prescription({
          customerId: customer._id,
          visitId: visit._id,
          ...body.prescription,
        });
        await prescription.save({ session });
        result.prescription = prescription;
      }
    }

    if (body.order) {
      const order = new Order({
        customerId: customer._id,
        visitId: (result.visit as any)?._id,
        ...body.order,
      });
      await order.save({ session });
      result.order = order;
    }

    if (body.bill) {
      const bill = new Bill({
        billNumber: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: customer._id,
        visitId: (result.visit as any)?._id,
        items: body.bill.items || [],
        subtotal: body.bill.subtotal || 0,
        discount: body.bill.discount || 0,
        totalAmount: body.bill.totalAmount || 0,
        advancePaid: body.payment?.amount || 0,
        pendingAmount: Math.max(0, (body.bill.totalAmount || 0) - (body.payment?.amount || 0)),
      });
      await bill.save({ session });
      result.bill = bill;

      const billTotalAmount = body.bill.totalAmount || 0;
      const billPendingAmount = Math.max(0, billTotalAmount - (body.payment?.amount || 0));
      if (billTotalAmount > 0) {
        await Customer.findByIdAndUpdate(customer._id, {
          $inc: { totalSpent: billTotalAmount, pendingAmount: billPendingAmount },
        }).session(session);
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
        await payment.save({ session });
        result.payment = payment;
      }
    }

    if (body.delivery) {
      const delivery = new Delivery({
        customerId: customer._id,
        orderId: (result.order as any)?._id,
        address: body.delivery.address,
        expectedDeliveryDate: body.delivery.expectedDeliveryDate
          ? new Date(body.delivery.expectedDeliveryDate)
          : undefined,
      });
      await delivery.save({ session });
      result.delivery = delivery;
    }

    return result;
  });
}

export function sendBillWhatsApp(
  bill: any,
  customer: any,
  branchId?: string
): void {
  if (!branchId || !customer?.mobile) return;

  (async () => {
    try {
      const { whatsappManager } = await import("./whatsapp");
      const wa = whatsappManager.getInstance(branchId);
      const settings = await Settings.findOne().sort({ updatedAt: -1 }).lean();
      const pdfBuffer = generateBillPdf(
        {
          billNumber: bill.billNumber, createdAt: bill.createdAt, items: bill.items,
          subtotal: bill.subtotal, discount: bill.discount, tax: (bill as any).tax,
          advancePaid: bill.advancePaid, pendingAmount: bill.pendingAmount,
          totalAmount: bill.totalAmount, status: bill.status,
        },
        {
          name: customer.name, mobile: customer.mobile,
          address: customer.address, customerId: customer.customerId,
        },
        {
          shopName: (settings as any)?.shopName || "KMJ Optical",
          shopAddress: (settings as any)?.shopAddress || "",
          shopPhone: (settings as any)?.shopPhone || "",
          shopEmail: (settings as any)?.shopEmail || "",
          logo: (settings as any)?.logo || "",
        }
      );
      const message = `Hi ${customer.name}, your bill ${bill.billNumber} has been generated! Total: ₹${(bill.totalAmount || 0).toFixed(2)}.`;
      const phone = normalizePhone(customer.mobile);
      logger.info(`WhatsApp [workspace]: sending to ***${phone.slice(-4)} for bill ${bill.billNumber}`);
      const sent = await wa.sendMedia(phone, pdfBuffer.toString("base64"), `${bill.billNumber}.pdf`, "application/pdf", message);
      if (!sent.ok) logger.error(`WhatsApp [workspace]: bill ${bill.billNumber} send failed: ${sent.error}`);
      else logger.info(`WhatsApp [workspace]: ${bill.billNumber} sent successfully`);
    } catch (err: any) {
      logger.error(`WhatsApp [workspace]: bill ${bill.billNumber} fire-and-forget error: ${err?.message || err}`);
    }
  })();
}
