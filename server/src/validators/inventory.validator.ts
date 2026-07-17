import { z } from "zod";
import { VALID_INVENTORY_CATEGORIES, VALID_INVENTORY_TYPES, VALID_GENDERS, VALID_LOCATIONS } from "../types";

export const createInventorySchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  category: z.enum(VALID_INVENTORY_CATEGORIES).optional(),
  inventoryType: z.enum(VALID_INVENTORY_TYPES).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  gender: z.enum(VALID_GENDERS).optional(),
  supplier: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().optional(),
  location: z.enum(VALID_LOCATIONS).optional(),
});

export const updateInventorySchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  gender: z.enum(VALID_GENDERS).optional(),
  supplier: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().optional(),
  category: z.enum(VALID_INVENTORY_CATEGORIES).optional(),
  inventoryType: z.enum(VALID_INVENTORY_TYPES).optional(),
  location: z.enum(VALID_LOCATIONS).optional(),
  sku: z.string().optional(),
}).strict();

export const stockAdjustSchema = z.object({
  quantity: z.number(),
});
