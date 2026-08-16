import { z } from "zod";
import { VALID_WITHDRAWAL_REASONS } from "../types";

export const addStockSchema = z
  .object({
    variantId: z.string().min(1, "variantId is required"),
    quantity: z.number().int().min(1),
    purchasePrice: z.number().min(0).default(0),
    sellingPrice: z.number().min(0).optional(),
    supplierId: z.string().optional(),
    supplierName: z.string().optional(),
    rackId: z.string().optional(),
    purchaseDate: z.string().or(z.date()).optional(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().or(z.date()).optional(),
    note: z.string().optional(),
  })
  .strict();

export const createVariantWithStockSchema = z
  .object({
    brand: z.string().optional(),
    brandId: z.string().optional(),
    category: z.string().optional(),
    inventoryType: z.string().optional(),
    model: z.string().min(1, "Model is required"),
    gender: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    sku: z.string().trim().min(1, "SKU is required"),
    quantity: z.number().int().min(1),
    purchasePrice: z.number().min(0).default(0),
    sellingPrice: z.number().min(0).optional(),
    rackId: z.string().optional(),
    supplierId: z.string().optional(),
    supplierName: z.string().optional(),
    material: z.string().optional(),
    frameShape: z.string().optional(),
    frameType: z.string().optional(),
    templeSize: z.string().optional(),
    bridgeSize: z.string().optional(),
    lensWidth: z.string().optional(),
    purchaseDate: z.string().or(z.date()).optional(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().or(z.date()).optional(),
    note: z.string().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const withdrawStockSchema = z
  .object({
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().min(1),
          lotId: z.string().optional(),
        })
      )
      .min(1, "At least one item is required"),
    reason: z.enum(VALID_WITHDRAWAL_REASONS).optional(),
    note: z.string().optional(),
  })
  .strict();

export const stockAdjustSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((v) => v !== 0, "Adjustment quantity must be non-zero"),
    note: z.string().optional(),
  })
  .strict();
