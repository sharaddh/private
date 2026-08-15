import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const InventoryCountEntrySchemaObj = new Schema(
  {
    countSessionId: { type: Schema.Types.ObjectId, ref: "InventoryCountSession", index: true },
    variantId: { type: Schema.Types.ObjectId, ref: "InventoryVariant", index: true },
    sku: { type: String, default: "" },
    brandName: { type: String, default: "" },
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    lotId: { type: Schema.Types.ObjectId, ref: "InventoryLot" },
    expectedQuantity: { type: Number, default: 0 },
    countedQuantity: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InventoryCountEntrySchemaObj.index({ countSessionId: 1, variantId: 1 });

export const InventoryCountEntrySchema = InventoryCountEntrySchemaObj;
const _InventoryCountEntry = model("InventoryCountEntry", InventoryCountEntrySchemaObj);
export const InventoryCountEntry = withBranch(_InventoryCountEntry, "InventoryCountEntry");
