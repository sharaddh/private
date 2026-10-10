import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
  email: z.union([z.string().email().trim(), z.literal("")]).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.string().optional(),
  alternateMobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customerId: z.string().optional(),
  // Ayushman Bharat Scheme fields
  isAyushman: z.boolean().optional(),
  abhaNumber: z.string().optional(),
  ayushmanLastUsedAt: z.union([z.string(), z.date()]).optional(),
  ayushmanUsedYear: z.number().int().optional(),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    mobile: z.string().optional(),
    email: z.union([z.string().email().trim(), z.literal("")]).optional(),
    age: z.number().int().min(0).max(150).optional(),
    gender: z.string().optional(),
    alternateMobile: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Ayushman Bharat Scheme fields
    isAyushman: z.boolean().optional(),
    abhaNumber: z.string().optional(),
    ayushmanLastUsedAt: z.union([z.string(), z.date()]).optional(),
    ayushmanUsedYear: z.number().int().optional(),
  })
  .strict();

export const customerQuerySchema = z.object({
  phone: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
