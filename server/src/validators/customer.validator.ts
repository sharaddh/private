import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.string().optional(),
  alternateMobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customerId: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.string().optional(),
  alternateMobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export const customerQuerySchema = z.object({
  phone: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
