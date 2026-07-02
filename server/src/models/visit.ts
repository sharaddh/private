import { Schema, model, Types } from "mongoose";

const VisitSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitDate: { type: Date, default: Date.now, index: true },
    doctorName: { type: String },
    shop: { type: String },
    shopId: { type: Types.ObjectId },
    remarks: { type: String }
  },
  { timestamps: true }
);

export const Visit = model("Visit", VisitSchema);
