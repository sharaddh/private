import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  code: z.string().min(1, "Branch code is required"),
  dbName: z.string().min(1, "Database name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  settings: z.object({
    shopName: z.string().optional(),
    shopAddress: z.string().optional(),
    shopPhone: z.string().optional(),
    shopEmail: z.string().optional(),
    adminWhatsApp: z.string().optional(),
    logo: z.string().optional(),
  }).optional(),
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
  settings: z.object({
    shopName: z.string().optional(),
    shopAddress: z.string().optional(),
    shopPhone: z.string().optional(),
    shopEmail: z.string().optional(),
    adminWhatsApp: z.string().optional(),
    logo: z.string().optional(),
  }).optional(),
}).strict();
