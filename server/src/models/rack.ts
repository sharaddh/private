import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

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
const _Rack = model("Rack", RackSchemaObj);
export const Rack = withBranch(_Rack, "Rack");
