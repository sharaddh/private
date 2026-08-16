import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const BrandSchemaObj = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    logo: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const BrandSchema = BrandSchemaObj;
export const Brand = scoped(prisma.brand) as Prisma.BrandDelegate;
