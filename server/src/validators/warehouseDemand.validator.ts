import { z } from "zod";

export const LENS_TYPES = ["plain", "sph", "cyl", "compound"] as const;

export const demandItemSchema = z.object({
  coating: z.string().min(1, "Coating is required"),
  lensType: z.enum(LENS_TYPES),
  powerKey: z.string().min(1, "powerKey is required"),
  qty: z.number().min(0.5).max(200).multipleOf(0.5),
});

export const createDemandSchema = z.object({
  items: z.array(demandItemSchema).max(5000).optional(),
});

export const updateDemandSchema = z.object({
  items: z.array(demandItemSchema).max(5000).min(1, "At least one item is required"),
});

export const demandStatusSchema = z.enum(["open", "sent", "closed"]);