import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";
import { VALID_WITHDRAWAL_REASONS } from "../types";

const InventoryWithdrawalV2ItemSchemaObj = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "InventoryVariant", index: true },
    sku: { type: String, required: true },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    category: { type: String, default: "" },
    lotId: { type: Schema.Types.ObjectId, ref: "InventoryLot" },
    lotBreakdown: [
      {
        lotId: { type: Schema.Types.ObjectId },
        quantity: { type: Number, default: 0 },
      },
    ],
    quantity: { type: Number, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const InventoryWithdrawalV2SchemaObj = new Schema(
  {
    items: { type: [InventoryWithdrawalV2ItemSchemaObj], required: true },
    reason: { type: String, enum: VALID_WITHDRAWAL_REASONS, default: "Other" },
    note: { type: String, default: "" },
    by: { type: String, default: "" },
    totalQty: { type: Number, required: true },
    totalPrice: { type: Number, default: 0 },
    reversed: { type: Boolean, default: false },
    reversedAt: { type: Date },
  },
  { timestamps: true }
);

InventoryWithdrawalV2SchemaObj.index({ createdAt: -1 });
InventoryWithdrawalV2SchemaObj.index({ by: 1, createdAt: -1 });

export const InventoryWithdrawalV2Schema = InventoryWithdrawalV2SchemaObj;
const _InventoryWithdrawalV2 = model("InventoryWithdrawalV2", InventoryWithdrawalV2SchemaObj);
export const InventoryWithdrawalV2 = withBranch(_InventoryWithdrawalV2, "InventoryWithdrawalV2");
