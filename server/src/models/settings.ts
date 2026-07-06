import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const SettingsSchemaObj = new Schema(
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

export const SettingsSchema = SettingsSchemaObj;
const _Settings = model("Settings", SettingsSchemaObj);
export const Settings = withBranch(_Settings, "Settings");
