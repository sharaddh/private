import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

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
export const Settings = scoped(prisma.settings) as Prisma.SettingsDelegate;
