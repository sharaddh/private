import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";
import { VALID_INVENTORY_MOVEMENT_TYPES, VALID_MOVEMENT_REFERENCES } from "../types";

const LotBreakdownSchemaObj = new Schema(
  {
    lotId: { type: Schema.Types.ObjectId, ref: "InventoryLot" },
    quantity: { type: Number, default: 0 },
  },
  { _id: false }
);

const InventoryMovementSchemaObj = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "InventoryVariant", index: true },
    sku: { type: String, default: "", index: true },
    lotId: { type: Schema.Types.ObjectId, ref: "InventoryLot" },
    lotBreakdown: { type: [LotBreakdownSchemaObj], default: [] },
    type: { type: String, enum: VALID_INVENTORY_MOVEMENT_TYPES, index: true },
    quantity: { type: Number, default: 0 },
    beforeQuantity: { type: Number, default: 0 },
    afterQuantity: { type: Number, default: 0 },
    referenceType: { type: String, enum: VALID_MOVEMENT_REFERENCES, default: "MANUAL" },
    referenceId: { type: Schema.Types.ObjectId, index: true },
    note: { type: String, default: "" },
    by: { type: String, default: "" },
    performedBy: { type: String, default: "" },
    rackId: { type: Schema.Types.ObjectId, ref: "Rack" },
    rackLabel: { type: String, default: "" },
    oldRackId: { type: Schema.Types.ObjectId, ref: "Rack" },
    newRackId: { type: Schema.Types.ObjectId, ref: "Rack" },
  },
  { timestamps: true }
);

InventoryMovementSchemaObj.index({ variantId: 1, createdAt: -1 });
InventoryMovementSchemaObj.index({ type: 1, createdAt: -1 });
InventoryMovementSchemaObj.index({ referenceId: 1 });
InventoryMovementSchemaObj.index({ createdAt: -1 });

export const InventoryMovementSchema = InventoryMovementSchemaObj;
const _InventoryMovement = model("InventoryMovement", InventoryMovementSchemaObj);
export const InventoryMovement = withBranch(_InventoryMovement, "InventoryMovement");
