import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const ShopCartItemSchemaObj = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coating: { type: String, required: true },
    lensType: { type: String, enum: ["sph", "cyl", "compound"], required: true },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ShopCartItemSchemaObj.index({ user: 1, coating: 1, lensType: 1, powerKey: 1 }, { unique: true });

export const ShopCartItemSchema = ShopCartItemSchemaObj;
export const ShopCartItem = scoped(prisma.shopCartItem) as Prisma.ShopCartItemDelegate;
