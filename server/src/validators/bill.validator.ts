import { z } from "zod";

export const createBillSchema = z.object({
  customerId: z.string().min(1),
  visitId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
  })).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  advancePaid: z.number().min(0).optional(),
}).strict();

export const updateBillSchema = z.object({
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
  })).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  advancePaid: z.number().min(0).optional(),
  status: z.enum(["Active", "Cancelled"]).optional(),
}).strict();
