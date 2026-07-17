import { z } from "zod";
import { VALID_PAYMENT_MODES } from "../types";

export const createPaymentSchema = z.object({
  customerId: z.string().min(1),
  billId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be positive"),
  paymentMode: z.enum(VALID_PAYMENT_MODES).optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePaymentSchema = z.object({
  customerId: z.string().optional(),
  billId: z.string().optional(),
  amount: z.number().min(0.01).optional(),
  paymentMode: z.enum(VALID_PAYMENT_MODES).optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
}).strict();
