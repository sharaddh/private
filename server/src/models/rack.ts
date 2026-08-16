import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const RackSchemaObj = new Schema(
  {
    name: { type: String, default: "" },
    code: { type: String, required: true, unique: true, trim: true },
    section: { type: String, default: "" },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const RackSchema = RackSchemaObj;
export const Rack = scoped(prisma.rack) as Prisma.RackDelegate;
