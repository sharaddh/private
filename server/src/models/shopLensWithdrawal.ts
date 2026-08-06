import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const ShopLensWithdrawalItemSchemaObj = new Schema(
  {
    coating: { type: String, required: true },
    lensType: { type: String, enum: ["sph", "cyl", "compound"], required: true },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const ShopLensWithdrawalSchemaObj = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    items: { type: [ShopLensWithdrawalItemSchemaObj], required: true },
    totalQuantity: { type: Number, required: true },
    totalPrice: { type: Number, default: 0 },
    note: { type: String, default: "" },
    withdrawnAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const ShopLensWithdrawalSchema = ShopLensWithdrawalSchemaObj;
const _ShopLensWithdrawal = model("ShopLensWithdrawal", ShopLensWithdrawalSchemaObj);
export const ShopLensWithdrawal = withBranch(_ShopLensWithdrawal, "ShopLensWithdrawal");
