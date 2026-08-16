import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";

// Kept for models/db.ts warehouse model registration (legacy scripts)
const _FogMarkSchemaObj = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

export const FogMarkSchema = _FogMarkSchemaObj;
export const FogMark = prisma.fogMark as Prisma.FogMarkDelegate;
