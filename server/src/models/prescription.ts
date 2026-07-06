import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const EyeSchema = new Schema({
  sph: { type: Number },
  cyl: { type: Number },
  axis: { type: Number },
  va: { type: String }
});

const PrescriptionSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    rightEye: { dv: EyeSchema, nv: EyeSchema, pc: EyeSchema },
    leftEye: { dv: EyeSchema, nv: EyeSchema, pc: EyeSchema },
    pd: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

PrescriptionSchemaObj.index({ customerId: 1, createdAt: -1 });
PrescriptionSchemaObj.index({ visitId: 1 });

export const PrescriptionSchema = PrescriptionSchemaObj;
const _Prescription = model("Prescription", PrescriptionSchemaObj);
export const Prescription = withBranch(_Prescription, "Prescription");
