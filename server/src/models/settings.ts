import { Schema, model } from "mongoose";

const SettingsSchema = new Schema(
  {
    shopName: { type: String, default: "KMJ Optical" },
    shopAddress: { type: String, default: "" },
    shopPhone: { type: String, default: "" },
    shopEmail: { type: String, default: "" },
    adminWhatsApp: { type: String, default: "" },
    logo: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Settings = model("Settings", SettingsSchema);
