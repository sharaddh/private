import { Router } from "express";
import { Bill } from "../models/bill";
import { Customer } from "../models/customer";
import { Settings } from "../models/settings";
import { Visit } from "../models/visit";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { whatsapp } from "../services/whatsapp";
import { generateBillPdf } from "../utils/pdf";

const router = Router();

const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  items: z.array(z.object({ description: z.string(), quantity: z.number().optional(), unitPrice: z.number().optional() })).optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  advancePaid: z.number().optional()
});

router.get("/", authenticate, async (req, res) => {
  const { customerId } = req.query;
  const filter: any = {};
  if (customerId) filter.customerId = customerId;
  const list = await Bill.find(filter)
    .populate("customerId", "name mobile customerId")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, data: list });
});

router.post("/", authenticate, audit, async (req, res) => {
  try {
    const p = createSchema.parse(req.body);
    const billNumber = `BILL-${Date.now()}`;
    const subtotal = (p.items || []).reduce((s, it) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
    const total = subtotal - (p.discount || 0) + (p.tax || 0);
    const bill = new Bill({ billNumber, ...p, subtotal, totalAmount: total, pendingAmount: total - (p.advancePaid || 0) } as any);
    await bill.save();

    const customer = await Customer.findById(p.customerId);
    if (customer) {
      customer.totalSpent = (customer.totalSpent || 0) + total;
      customer.pendingAmount = (customer.pendingAmount || 0) + bill.pendingAmount;
      await customer.save();
    }

    // Send WhatsApp message with bill PDF
    if (customer?.mobile && whatsapp.ready) {
      try {
        const settings = await Settings.findOne();
        const visit = p.visitId ? await Visit.findById(p.visitId) : null;

        console.log(`Generating PDF for bill ${bill.billNumber} for customer ${customer.name}`);
        const pdfBuffer = generateBillPdf(
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
          {
            name: customer.name,
            mobile: customer.mobile,
            address: customer.address,
            customerId: customer.customerId,
          },
          {
            shopName: settings?.shopName || "KMJ Optical",
            shopAddress: settings?.shopAddress || "",
            shopPhone: settings?.shopPhone || "",
            shopEmail: settings?.shopEmail || "",
            logo: settings?.logo || "",
          }
        );

        console.log(`PDF generated successfully for bill ${bill.billNumber}, buffer length: ${pdfBuffer.length}`);

        const message = `Hi ${customer.name}, your bill ${bill.billNumber} has been generated! Total: ₹${total.toFixed(2)}. Please find the PDF attached.`;
        console.log(`Attempting to send WhatsApp message to ${customer.mobile} with message: ${message}`);
        const sent = await whatsapp.sendMedia(customer.mobile, pdfBuffer.toString("base64"), `${bill.billNumber}.pdf`, message);
        
        if (sent) {
          console.log(`Bill PDF sent successfully to ${customer.mobile} for bill ${bill.billNumber}`);
        } else {
          console.error(`Failed to send bill PDF to ${customer.mobile} for bill ${bill.billNumber}`);
        }
      } catch (err: any) {
        console.error(`Error sending WhatsApp message for bill ${bill.billNumber}:`, err);
      }
    } else if (customer?.mobile) {
      console.log(`WhatsApp not ready, skipping bill PDF notification for ${customer.mobile}`);
    } else {
      console.log(`No mobile number for customer ${customer?.name}, skipping bill PDF notification`);
    }

    res.json({ success: true, data: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  const b = await Bill.findById(req.params.id);
  if (!b) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: b });
});

router.put("/:id", authenticate, audit, async (req, res) => {
  try {
    const p = req.body;
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Not found" });
    if (p.items) {
      bill.subtotal = (p.items || []).reduce((s: number, it: any) => s + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
      bill.totalAmount = bill.subtotal - (p.discount ?? bill.discount) + (p.tax ?? bill.tax);
      bill.pendingAmount = bill.totalAmount - (p.advancePaid ?? bill.advancePaid);
    }
    Object.assign(bill, p);
    await bill.save();
    res.json({ success: true, data: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", authenticate, audit, async (req, res) => {
  try {
    const b = await Bill.findByIdAndDelete(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
