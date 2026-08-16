import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";
import { VALID_GENDERS } from "../types";

const InventoryVariantSchemaObj = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "InventoryProduct", index: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", index: true },
    brandName: { type: String, default: "", index: true },
    category: { type: String, default: "", index: true },
    model: { type: String, default: "", index: true },
    gender: { type: String, enum: VALID_GENDERS, default: "" },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    variantCode: { type: String, default: "" },
    color: { type: String, default: "", index: true },
    size: { type: String, default: "" },
    material: { type: String, default: "" },
    frameShape: { type: String, default: "" },
    frameType: { type: String, default: "" },
    templeSize: { type: String, default: "" },
    bridgeSize: { type: String, default: "" },
    lensWidth: { type: String, default: "" },
    status: { type: String, default: "active" },
    attributes: { type: Schema.Types.Mixed, default: {} },
    image: { type: String, default: "" },
    stockQuantity: { type: Number, default: 0, min: 0 },
    defaultSellingPrice: { type: Number, default: 0 },
    rackId: { type: Schema.Types.ObjectId, ref: "Rack", index: true },
    rackLabel: { type: String, default: "" },
    supplierId: { type: Schema.Types.ObjectId },
    supplierName: { type: String, default: "" },
    lastSoldAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryVariantSchemaObj.index({ productId: 1, color: 1 });
InventoryVariantSchemaObj.index({ rackId: 1, active: 1 });
InventoryVariantSchemaObj.index({ brandName: 1, model: 1 });
InventoryVariantSchemaObj.index({ active: 1, stockQuantity: 1 });

export const InventoryVariantSchema = InventoryVariantSchemaObj;
export const InventoryVariant = scoped(prisma.inventoryVariant) as Prisma.InventoryVariantDelegate;
