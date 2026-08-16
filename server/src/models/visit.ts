import { Schema, Types } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const VisitSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitDate: { type: Date, default: Date.now, index: true },
    visitType: {
      type: String,
      enum: ["new", "frame_change", "new_lens", "contact_lens", "service", "other"],
      default: "new",
    },
    doctorName: { type: String },
    shop: { type: String },
    shopId: { type: Types.ObjectId },
    remarks: { type: String },
  },
  { timestamps: true }
);

VisitSchemaObj.index({ customerId: 1, visitDate: -1 });

export const VisitSchema = VisitSchemaObj;
export const Visit = scoped(prisma.visit) as Prisma.VisitDelegate;
