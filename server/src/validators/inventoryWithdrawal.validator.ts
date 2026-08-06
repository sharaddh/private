import { z } from "zod";

export const createWithdrawalSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1, "SKU is required"),
        qty: z.number().int().min(1, "Quantity must be at least 1"),
        price: z.number().min(0).optional(),
      })
    )
    .min(1, "No items to withdraw")
    .max(500, "Max 500 items per withdrawal"),
  note: z.string().optional(),
});

export const listWithdrawalsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
