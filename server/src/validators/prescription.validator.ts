import { z } from "zod";

const eyeSchema = z.object({
  sph: z.number().optional(),
  cyl: z.number().optional(),
  axis: z.number().optional(),
  va: z.string().optional(),
});

export const createPrescriptionSchema = z.object({
  customerId: z.string().min(1),
  visitId: z.string().optional(),
  rightEye: z.object({
    dv: eyeSchema.optional(),
    nv: eyeSchema.optional(),
    pc: eyeSchema.optional(),
  }).optional(),
  leftEye: z.object({
    dv: eyeSchema.optional(),
    nv: eyeSchema.optional(),
    pc: eyeSchema.optional(),
  }).optional(),
  pd: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePrescriptionSchema = createPrescriptionSchema.partial();
