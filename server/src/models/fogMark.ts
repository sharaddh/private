import { Schema, model } from "mongoose";

const FogMarkSchemaObj = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

FogMarkSchemaObj.index({ name: 1 }, { unique: true });

export const FogMarkSchema = FogMarkSchemaObj;
export const FogMark = model("FogMark", FogMarkSchemaObj);
