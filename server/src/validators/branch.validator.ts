import { z } from "zod";

const optionListSchema = z.array(z.string().trim().min(1).max(100)).max(200);

const branchSettingsSchema = z.object({
  shopName: z.string().optional(),
  shopAddress: z.string().optional(),
  shopPhone: z.string().optional(),
  shopEmail: z.string().optional(),
  adminWhatsApp: z.string().optional(),
  logo: z.string().optional(),
  frameColors: optionListSchema.optional(),
  lensFeatures: optionListSchema.optional(),
  lensIndexes: optionListSchema.optional(),
  lensCoatings: optionListSchema.optional(),
  accessoryNames: optionListSchema.optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  code: z.string().min(1, "Branch code is required"),
  dbName: z.string().min(1, "Database name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().optional(),
  logo: z.string().optional(),
  ownerUsername: z.string().min(1, "Owner username is required"),
  ownerPassword: z.string().min(4, "Owner password must be at least 4 characters"),
  settings: branchSettingsSchema.optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  dbName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().optional(),
  logo: z.string().optional(),
  ownerUsername: z.string().optional(),
  ownerPassword: z.string().optional(),
  settings: branchSettingsSchema.optional(),
});
