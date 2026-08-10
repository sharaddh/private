import { z } from "zod";
import { VALID_PRODUCT_CATEGORIES, VALID_GENDERS } from "../types";

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(80),
  description: z.string().optional(),
  logo: z.string().optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

export const createProductSchema = z.object({
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  category: z.enum(VALID_PRODUCT_CATEGORIES).optional(),
  inventoryType: z.string().optional(),
  model: z.string().trim().min(1, "Model is required"),
  gender: z.enum(VALID_GENDERS).optional(),
  description: z.string().optional(),
}).strict();

export const updateProductSchema = z.object({
  category: z.enum(VALID_PRODUCT_CATEGORIES).optional(),
  inventoryType: z.string().optional(),
  model: z.string().trim().min(1).optional(),
  gender: z.enum(VALID_GENDERS).optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  active: z.boolean().optional(),
  sizeOptions: z.array(z.string()).optional(),
}).strict();
