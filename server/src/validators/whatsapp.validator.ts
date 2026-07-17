import { z } from "zod";

export const sendTextSchema = z.object({
  phone: z.string().min(1),
  message: z.string().min(1),
});

export const sendMediaSchema = z.object({
  phone: z.string().min(1),
  base64: z.string().min(1),
  filename: z.string().min(1),
  caption: z.string().optional(),
  mimetype: z.string().optional(),
});

export const pairSchema = z.object({
  phone: z.string().min(1),
});

export const broadcastSchema = z.object({
  numbers: z.array(z.string()).min(1),
  message: z.string().optional(),
  antiban: z.object({
    delayMin: z.number().optional(),
    delayMax: z.number().optional(),
    batchSize: z.number().optional(),
    pause: z.number().optional(),
  }).optional(),
  media: z.object({
    base64: z.string(),
    filename: z.string(),
    mimetype: z.string(),
  }).optional(),
});
