import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";
import { VALID_LOT_SOURCES } from "../types";

const InventoryLotSchemaObj = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "InventoryVariant", index: true },
    lotNumber: { type: String, default: "" },
    initialQuantity: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    supplierId: { type: Schema.Types.ObjectId },
    supplierName: { type: String, default: "" },
    rackId: { type: Schema.Types.ObjectId, ref: "Rack" },
    rackLabel: { type: String, default: "" },
    purchaseDate: { type: Date },
    batchNumber: { type: String, default: "" },
    expiryDate: { type: Date },
    source: { type: String, enum: VALID_LOT_SOURCES, default: "PURCHASE" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

InventoryLotSchemaObj.index({ variantId: 1, createdAt: 1 });
InventoryLotSchemaObj.index({ variantId: 1, expiryDate: 1 });

export const InventoryLotSchema = InventoryLotSchemaObj;
export const InventoryLot = scoped(prisma.inventoryLot) as Prisma.InventoryLotDelegate;
