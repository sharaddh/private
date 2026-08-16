import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";
import { VALID_COUNT_STATUSES } from "../types";

const InventoryCountSessionSchemaObj = new Schema(
  {
    rackId: { type: Schema.Types.ObjectId, ref: "Rack", index: true },
    rackLabel: { type: String, default: "" },
    status: { type: String, enum: VALID_COUNT_STATUSES, default: "draft", index: true },
    startedBy: { type: String, default: "" },
    completedBy: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    expectedUnits: { type: Number, default: 0 },
    countedUnits: { type: Number, default: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export const InventoryCountSessionSchema = InventoryCountSessionSchemaObj;
export const InventoryCountSession = scoped(prisma.inventoryCountSession) as Prisma.InventoryCountSessionDelegate;
