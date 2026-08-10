import { z } from "zod";

export const createCountSessionSchema = z.object({
  rackId: z.string().min(1, "rackId is required"),
  note: z.string().optional(),
}).strict();

export const updateCountEntriesSchema = z.object({
  entries: z
    .array(
      z.object({
        variantId: z.string().min(1),
        countedQuantity: z.number().int().min(0),
      })
    )
    .min(1, "At least one entry is required"),
}).strict();

export const completeCountSessionSchema = z.object({
  note: z.string().optional(),
}).strict();
