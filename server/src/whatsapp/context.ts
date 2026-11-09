import { prisma } from "../db/prisma";
import { generateBillPdf } from "../utils/pdf";
import { TemplateMappingError } from "./templates";

export interface EventDataContext {
  category: "transactional" | "marketing";
  eventKey: string;
  customerId: string;
  customerName: string;
  values: Record<string, string>;
  document?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function orderNumber(id: string): string {
  return `ORD-${id.replace(/-/g, "").slice(-8).toUpperCase()}`;
}

async function customerFor(customerId: string, branchId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId },
    select: { id: true, name: true, mobile: true },
  });
  if (!customer) throw new TemplateMappingError("Customer no longer exists", "customer_missing");
  return customer;
}

export async function buildEventContext(params: {
  branchId: string;
  eventKey: string;
  entityType: string;
  entityId: string;
  customerId: string;
  payload: Record<string, unknown>;
}): Promise<EventDataContext> {
  const customer = await customerFor(params.customerId, params.branchId);
  const values: Record<string, string> = {
    customer_name: customer.name || "Customer",
    customer_mobile: customer.mobile || "",
  };

  if (params.eventKey.startsWith("ORDER_")) {
    const order = await prisma.order.findFirst({
      where: { id: params.entityId, branchId: params.branchId },
    });
    if (!order) throw new TemplateMappingError("Order no longer exists", "order_missing");
    values.order_number = orderNumber(order.id);
    const bill = await prisma.bill.findFirst({
      where: { branchId: params.branchId, customerId: params.customerId, status: "Active" },
      orderBy: { createdAt: "desc" },
    });
    if (bill) {
      values.bill_number = bill.billNumber;
      values.pending_amount = money(bill.pendingAmount);
      values.total_amount = money(bill.totalAmount);
    }
  } else if (params.eventKey === "INVOICE_GENERATED") {
    const bill = await prisma.bill.findFirst({
      where: { id: params.entityId, branchId: params.branchId },
      include: {
        items: true,
        customer: { select: { id: true, name: true, mobile: true, customerId: true } },
      },
    });
    if (!bill) throw new TemplateMappingError("Invoice no longer exists", "invoice_missing");
    if (bill.customerId !== params.customerId) {
      throw new TemplateMappingError(
        "Invoice does not belong to the requested customer",
        "invoice_customer_mismatch"
      );
    }
    const settings = await prisma.settings.findUnique({ where: { branchId: params.branchId } });
    const buffer = generateBillPdf(
      {
        billNumber: bill.billNumber,
        createdAt: bill.createdAt,
        items: bill.items,
        subtotal: bill.subtotal,
        discount: bill.discount,
        tax: bill.tax,
        advancePaid: bill.advancePaid,
        pendingAmount: bill.pendingAmount,
        totalAmount: bill.totalAmount,
        status: bill.status,
      },
      bill.customer,
      {
        ...settings,
      }
    );
    if (buffer.length < 1000 || !buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      throw new TemplateMappingError("Invoice PDF generation failed", "pdf_incomplete");
    }
    values.bill_number = bill.billNumber;
    values.total_amount = money(bill.totalAmount);
    values.pending_amount = money(bill.pendingAmount);
    return {
      category: "transactional",
      eventKey: params.eventKey,
      customerId: bill.customerId,
      customerName: bill.customer.name || customer.name || "Customer",
      values,
      document: {
        buffer,
        filename: `Invoice-${bill.billNumber}.pdf`,
        mimeType: "application/pdf",
      },
    };
  } else if (params.eventKey.startsWith("PAYMENT_")) {
    const billId = String(params.payload.billId || "");
    if (!billId) throw new TemplateMappingError("Bill reference is missing", "bill_missing");
    const bill = await prisma.bill.findFirst({
      where: { id: billId, branchId: params.branchId },
    });
    if (!bill) throw new TemplateMappingError("Bill no longer exists", "bill_missing");
    if (bill.customerId !== params.customerId) {
      throw new TemplateMappingError(
        "Bill does not belong to the requested customer",
        "bill_customer_mismatch"
      );
    }
    if (bill.status === "Cancelled") {
      throw new TemplateMappingError("Invoice is cancelled", "invoice_cancelled");
    }
    if (params.eventKey === "PAYMENT_BALANCE_DUE" && bill.pendingAmount <= 0) {
      throw new TemplateMappingError("Balance is already settled", "nothing_due");
    }
    const paymentId = String(params.payload.paymentId || "");
    const payment = paymentId
      ? await prisma.payment.findFirst({
          where: { id: paymentId, branchId: params.branchId },
        })
      : null;
    values.bill_number = bill.billNumber;
    values.amount = money(Number(params.payload.amount || payment?.amount || 0));
    values.pending_amount = money(bill.pendingAmount);
    values.total_amount = money(bill.totalAmount);
  } else if (params.eventKey === "MARKETING_CAMPAIGN") {
    values.customer_name = customer.name || "Customer";
  }

  return {
    category: params.eventKey === "MARKETING_CAMPAIGN" ? "marketing" : "transactional",
    eventKey: params.eventKey,
    customerId: customer.id,
    customerName: customer.name || "Customer",
    values,
  };
}
