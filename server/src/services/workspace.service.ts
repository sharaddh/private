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

  await prisma.$transaction(async (tx) => {
    if (stockRef) {
      await assertStockAvailable(stockRef, tx);
    }

    let customer: any = null;
    if (body.customerId) {
      customer = await tx.customer.findUnique({ where: { id: body.customerId } });
    }
    if (!customer && body.customer?.id) {
      customer = await tx.customer.findUnique({ where: { id: body.customer.id } });
    }
    if (!customer && body.customer?.mobile) {
      customer = await tx.customer.findFirst({ where: { mobile: body.customer.mobile } });
    }
    if (!customer && body.customer) {
      customer = await tx.customer.create({
        data: {
          ...body.customer,
          name: body.customer.name || body.customer.mobile || "Customer",
          customerId: `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          branchId: requireBranchId(),
        },
      });
    }

    if (!customer) {
      throw new AppError(400, "Customer not found or created");
    }
    result.customer = customer;

    if (body.visit) {
      const visit = await tx.visit.create({
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
      await tx.customer.update({
        where: { id: customer.id },
        data: { totalVisits: { increment: 1 } },
      });

      if (body.prescription) {
        const prescription = await tx.prescription.create({
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
      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          visitId: (result.visit as any)?.id,
          branchId: requireBranchId(),
          ...body.order,
        },
      });
      await decrementStockForOrder(order as any, tx);
      result.order = order;
    } else if (stockRef) {
      await decrementStockForOrder(stockRef, tx);
    }

    if (body.bill) {
      const items = (body.bill.items || []).map((it: any) => ({
        description: it.description || "",
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
      }));
      const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      const discount = body.bill.discount || 0;
      const totalAmount = Math.max(0, subtotal - discount);
      const advancePaid = body.payment?.amount || 0;
      const pendingAmount = Math.max(0, totalAmount - advancePaid);

      const bill = await tx.bill.create({
        data: {
          billNumber: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customerId: customer.id,
          visitId: (result.visit as any)?.id,
          branchId: requireBranchId(),
          items: {
            create: items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.quantity * it.unitPrice,
            })),
          },
          stockItems: {
            create: (Array.isArray(body.stockItems) ? body.stockItems : []).map((it: any) => ({
              sku: it.sku || "",
              quantity: it.quantity || 0,
            })),
          },
          subtotal,
          discount,
          totalAmount,
          advancePaid,
          pendingAmount,
        },
      });
      result.bill = bill;

      if (totalAmount > 0) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalSpent: { increment: totalAmount },
            pendingAmount: { increment: pendingAmount },
          },
        });
      }

      if (advancePaid > 0) {
        const paymentInput = body.payment;
        const payment = await tx.payment.create({
          data: {
            customerId: customer.id,
            billId: bill.id,
            amount: advancePaid,
            paymentMode: paymentInput?.paymentMode || paymentInput?.mode || "Cash",
            paymentDate: new Date(),
            notes: paymentInput?.notes || "Advance payment",
            branchId: requireBranchId(),
          },
        });
        result.payment = payment;
      }
    }

    if (body.delivery) {
      const delivery = await tx.delivery.create({
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
  });

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
