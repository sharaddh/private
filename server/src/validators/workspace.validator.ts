import { z } from "zod";

export const transactionSchema = z.object({
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
    visitType: z.string().optional(),
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
