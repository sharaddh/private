import { prisma } from "../db/prisma";
import { requireBranchId } from "../utils/scope";
import { AppError } from "../middleware/errorHandler";
import { generateBillPdf } from "../utils/pdf";
import { normalizePhone } from "../utils/phone";
import { logger } from "../utils/logger";
import {
  decrementStockForOrder,
  assertStockAvailable,
  type OrderStockRef,
  type StockItemRef,
} from "./inventory.service";

interface TransactionInput {
  customerId?: string;
  customer?: {
    id?: string;
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
  stockItems?: StockItemRef[];
}

export async function executeTransaction(
  body: TransactionInput,
  _branchId?: string
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  const stockRef: OrderStockRef | undefined = body.order
    ? (body.order as OrderStockRef)
    : Array.isArray(body.stockItems) && body.stockItems.length > 0
      ? { stockItems: body.stockItems }
      : undefined;

  if (stockRef) {
    await assertStockAvailable(stockRef);
  }

  let customer: any = null;
  if (body.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
  }
  if (!customer && body.customer?.id) {
    customer = await prisma.customer.findUnique({ where: { id: body.customer.id } });
  }
  if (!customer && body.customer?.mobile) {
    customer = await prisma.customer.findFirst({ where: { mobile: body.customer.mobile } });
  }
  if (!customer && body.customer) {
    customer = await prisma.customer.create({
      data: {
        ...body.customer,
        customerId: `CUST-${Date.now()}`,
        branchId: requireBranchId(),
      },
    });
  }

  if (!customer) {
    throw new AppError(400, "Customer not found or created");
  }
  result.customer = customer;

  if (body.visit) {
    const visit = await prisma.visit.create({
      data: {
        customerId: customer.id,
        visitDate: body.visit.visitDate ? new Date(body.visit.visitDate) : new Date(),
        visitType: (body.visit.visitType as any) || "new",
        doctorName: body.visit.doctorName,
        shop: body.visit.shop,
        remarks: body.visit.remarks,
        branchId: requireBranchId(),
      },
    });
    result.visit = visit;
    await prisma.customer.update({
      where: { id: customer.id },
      data: { totalVisits: { increment: 1 } },
    });

    if (body.prescription) {
      const prescription = await prisma.prescription.create({
        data: {
          customerId: customer.id,
          visitId: visit.id,
          branchId: requireBranchId(),
          ...body.prescription,
        },
      });
      result.prescription = prescription;
    }
  }

  if (body.order) {
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        visitId: (result.visit as any)?.id,
        branchId: requireBranchId(),
        ...body.order,
      },
    });
    await decrementStockForOrder(order as any);
    result.order = order;
  } else if (stockRef) {
    await decrementStockForOrder(stockRef);
  }

  if (body.bill) {
    const bill = await prisma.bill.create({
      data: {
        billNumber: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: customer.id,
        visitId: (result.visit as any)?.id,
        branchId: requireBranchId(),
        items: {
          create: (body.bill.items || []).map((it: any) => ({
            description: it.description || "",
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            total: (it.quantity || 1) * (it.unitPrice || 0),
          })),
        },
        stockItems: {
          create: (Array.isArray(body.stockItems) ? body.stockItems : []).map((it: any) => ({
            sku: it.sku || "",
            quantity: it.quantity || 0,
          })),
        },
        subtotal: body.bill.subtotal || 0,
        discount: body.bill.discount || 0,
        totalAmount: body.bill.totalAmount || 0,
        advancePaid: body.payment?.amount || 0,
        pendingAmount: Math.max(0, (body.bill.totalAmount || 0) - (body.payment?.amount || 0)),
      },
    });
    result.bill = bill;

    const billTotalAmount = body.bill.totalAmount || 0;
    const billPendingAmount = Math.max(0, billTotalAmount - (body.payment?.amount || 0));
    if (billTotalAmount > 0) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalSpent: { increment: billTotalAmount },
          pendingAmount: { increment: billPendingAmount },
        },
      });
    }

    if (body.payment?.amount != null && body.payment.amount > 0) {
      const payment = await prisma.payment.create({
        data: {
          customerId: customer.id,
          billId: bill.id,
          amount: body.payment.amount,
          paymentMode: body.payment.paymentMode || body.payment.mode || "Cash",
          paymentDate: new Date(),
          notes: body.payment.notes || "Advance payment",
          branchId: requireBranchId(),
        },
      });
      result.payment = payment;
    }
  }

  if (body.delivery) {
    const delivery = await prisma.delivery.create({
      data: {
        customerId: customer.id,
        orderId: (result.order as any)?.id,
        address: body.delivery.address,
        expectedDeliveryDate: body.delivery.expectedDeliveryDate
          ? new Date(body.delivery.expectedDeliveryDate)
          : undefined,
        branchId: requireBranchId(),
      },
    });
    result.delivery = delivery;
  }

  return result;
}

export function sendBillWhatsApp(bill: any, customer: any, branchId?: string): void {
  if (!branchId || !customer?.mobile) return;

  (async () => {
    try {
      const { whatsappManager } = await import("./whatsapp");
      const wa = whatsappManager.getInstance(branchId);
      const settings = await prisma.settings.findFirst({ orderBy: { updatedAt: "desc" } });
      const pdfBuffer = generateBillPdf(
        {
          billNumber: bill.billNumber,
          createdAt: bill.createdAt,
          items: bill.items,
          subtotal: bill.subtotal,
          discount: bill.discount,
          tax: (bill as any).tax,
          advancePaid: bill.advancePaid,
          pendingAmount: bill.pendingAmount,
          totalAmount: bill.totalAmount,
          status: bill.status,
        },
        {
          name: customer.name,
          mobile: customer.mobile,
          address: customer.address,
          customerId: customer.customerId,
        },
        {
          shopName: (settings as any)?.shopName || "KMJ Optical",
          shopAddress: (settings as any)?.shopAddress || "",
          shopPhone: (settings as any)?.shopPhone || "",
          shopEmail: (settings as any)?.shopEmail || "",
          logo: (settings as any)?.logo || "",
        }
      );

      const randomDelay = 3000 + Math.random() * 5000;
      await new Promise((r) => setTimeout(r, randomDelay));

      const message = `Hi ${customer.name}, your bill ${bill.billNumber} has been generated! Total: ₹${(bill.totalAmount || 0).toFixed(2)}.`;
      const phone = normalizePhone(customer.mobile);
      logger.info(
        `WhatsApp [workspace]: sending to ***${phone.slice(-4)} for bill ${bill.billNumber} (delayed ${Math.round(randomDelay)}ms)`
      );
      const sent = await wa.sendMedia(
        phone,
        pdfBuffer.toString("base64"),
        `${bill.billNumber}.pdf`,
        "application/pdf",
        message
      );
      if (!sent.ok)
        logger.error(`WhatsApp [workspace]: bill ${bill.billNumber} send failed: ${sent.error}`);
      else logger.info(`WhatsApp [workspace]: ${bill.billNumber} sent successfully`);
    } catch (err: any) {
      logger.error(
        `WhatsApp [workspace]: bill ${bill.billNumber} fire-and-forget error: ${err?.message || err}`
      );
    }
  })();
}
