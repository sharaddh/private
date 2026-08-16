import { Schema, Types } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const BillItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
});

const StockItemSchema = new Schema({
  sku: { type: String },
  quantity: { type: Number, default: 1 },
});

const BillSchemaObj = new Schema(
  {
    billNumber: { type: String, index: true, unique: true },
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    items: { type: [BillItemSchema], default: [] },
    stockItems: { type: [StockItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Cancelled"], default: "Active" },
  },
  { timestamps: true }
);

BillSchemaObj.index({ customerId: 1, createdAt: -1 });
BillSchemaObj.index({ pendingAmount: 1 });
BillSchemaObj.index({ createdAt: -1 });

export const BillSchema = BillSchemaObj;
export const Bill = scoped(prisma.bill) as Prisma.BillDelegate;
