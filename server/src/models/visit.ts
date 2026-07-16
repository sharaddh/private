import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const VisitSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitDate: { type: Date, default: Date.now, index: true },
    visitType: { type: String, enum: ["new", "frame_change", "new_lens", "contact_lens", "service", "other"], default: "new" },
    doctorName: { type: String },
    shop: { type: String },
    shopId: { type: Types.ObjectId },
    remarks: { type: String }
  },
  { timestamps: true }
);

VisitSchemaObj.index({ customerId: 1, visitDate: -1 });

export const VisitSchema = VisitSchemaObj;
const _Visit = model("Visit", VisitSchemaObj);
export const Visit = withBranch(_Visit, "Visit");
