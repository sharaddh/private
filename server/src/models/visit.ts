import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const VisitSchemaObj = new Schema(
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

export const VisitSchema = VisitSchemaObj;
const _Visit = model("Visit", VisitSchemaObj);
export const Visit = withBranch(_Visit, "Visit");
