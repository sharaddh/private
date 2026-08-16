import { z } from "zod";

export const createRackSchema = z
  .object({
    name: z.string().optional(),
    code: z.string().trim().min(1, "Rack code is required").max(40),
    section: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional(),
  })
  .strict();

export const updateRackSchema = z
  .object({
    name: z.string().optional(),
    code: z.string().trim().min(1).max(40).optional(),
    section: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional(),
    active: z.boolean().optional(),
  })
  .strict();
