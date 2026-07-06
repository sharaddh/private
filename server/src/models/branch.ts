import { Schema, model } from "mongoose";

const BranchSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    dbName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    settings: {
      shopName: { type: String, default: "" },
      shopAddress: { type: String, default: "" },
      shopPhone: { type: String, default: "" },
      shopEmail: { type: String, default: "" },
      adminWhatsApp: { type: String, default: "" },
      logo: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const Branch = model("Branch", BranchSchema);
