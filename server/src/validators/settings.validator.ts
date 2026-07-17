import { z } from "zod";

export const updateSettingsSchema = z.object({
  shopName: z.string().optional(),
  shopAddress: z.string().optional(),
  shopPhone: z.string().optional(),
  shopEmail: z.string().optional(),
  adminWhatsApp: z.string().optional(),
  logo: z.string().optional(),
}).strict();
