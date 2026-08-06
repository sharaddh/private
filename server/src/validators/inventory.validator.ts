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
  lensIndex: z.string().optional(),
  lensCoating: z.string().optional(),
  sphRight: z.string().optional(),
  cylRight: z.string().optional(),
  axisRight: z.string().optional(),
  sphLeft: z.string().optional(),
  cylLeft: z.string().optional(),
  axisLeft: z.string().optional(),
  addPower: z.string().optional(),
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
  lensIndex: z.string().optional(),
  lensCoating: z.string().optional(),
  sphRight: z.string().optional(),
  cylRight: z.string().optional(),
  axisRight: z.string().optional(),
  sphLeft: z.string().optional(),
  cylLeft: z.string().optional(),
  axisLeft: z.string().optional(),
  addPower: z.string().optional(),
}).strict();

export const stockAdjustSchema = z.object({
  quantity: z.number(),
  note: z.string().optional(),
});

export const importInventorySchema = z.object({
  items: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "No items to import")
    .max(1000, "Max 1000 items per import"),
  note: z.string().optional(),
});
