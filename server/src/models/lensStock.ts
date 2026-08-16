import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const LensStockSchemaObj = new Schema(
  {
    coating: { type: String, required: true },
    price: { type: Number, default: 0, min: 0 },
    priceNeg: { type: Number, default: 0, min: 0 },
    pricePos: { type: Number, default: 0, min: 0 },
    quantities: {
      type: Schema.Types.Mixed,
      default: { sph: {}, cyl: {}, compound: {} },
    },
  },
  { timestamps: true }
);

LensStockSchemaObj.index({ coating: 1 }, { unique: true });

export const LensStockSchema = LensStockSchemaObj;
export const LensStock = scoped(prisma.lensStock) as Prisma.LensStockDelegate;
