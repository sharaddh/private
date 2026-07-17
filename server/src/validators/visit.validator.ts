import { z } from "zod";
import { VALID_VISIT_TYPES } from "../types";

export const createVisitSchema = z.object({
  customerId: z.string().min(1),
  visitDate: z.string().optional(),
  visitType: z.enum(VALID_VISIT_TYPES).optional(),
  doctorName: z.string().optional(),
  shopId: z.string().optional(),
  remarks: z.string().optional(),
});

export const updateVisitSchema = z.object({
  visitDate: z.string().optional(),
  visitType: z.enum(VALID_VISIT_TYPES).optional(),
  doctorName: z.string().optional(),
  shopId: z.string().optional(),
  remarks: z.string().optional(),
}).strict();
