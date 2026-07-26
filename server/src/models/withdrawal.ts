import { Schema, model, Types } from "mongoose";

const WithdrawalItemSchema = new Schema(
  {
    coating: { type: String, required: true },
    lensType: { type: String, required: true },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const WithdrawalSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    items: { type: [WithdrawalItemSchema], required: true },
    totalQuantity: { type: Number, required: true },
    withdrawnAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const Withdrawal = model("Withdrawal", WithdrawalSchema);
