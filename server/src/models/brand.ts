import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

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
const _Brand = model("Brand", BrandSchemaObj);
export const Brand = withBranch(_Brand, "Brand");
