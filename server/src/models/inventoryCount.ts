import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";
import { VALID_COUNT_STATUSES } from "../types";

const InventoryCountSessionSchemaObj = new Schema(
  {
    rackId: { type: Schema.Types.ObjectId, ref: "Rack", index: true },
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
const _InventoryCountSession = model("InventoryCountSession", InventoryCountSessionSchemaObj);
export const InventoryCountSession = withBranch(_InventoryCountSession, "InventoryCountSession");
