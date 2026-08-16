import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const InventoryWithdrawalItemSchemaObj = new Schema(
  {
    sku: { type: String, required: true },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    category: { type: String, default: "" },
    qty: { type: Number, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const InventoryWithdrawalSchemaObj = new Schema(
  {
    items: { type: [InventoryWithdrawalItemSchemaObj], required: true },
    note: { type: String, default: "" },
    by: { type: String, default: "" },
    totalQty: { type: Number, required: true },
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const InventoryWithdrawalSchema = InventoryWithdrawalSchemaObj;
export const InventoryWithdrawal = scoped(prisma.inventoryWithdrawal) as Prisma.InventoryWithdrawalDelegate;
