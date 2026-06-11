import { Schema, model, Types } from "mongoose";

const EyeSchema = new Schema({
  sph: { type: Number },
  cyl: { type: Number },
  axis: { type: Number },
  va: { type: String }
});

const PrescriptionSchema = new Schema(
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

export const Prescription = model("Prescription", PrescriptionSchema);
