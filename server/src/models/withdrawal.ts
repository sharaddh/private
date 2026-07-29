import { Schema, model, Types } from "mongoose";

const WithdrawalItemSchemaObj = new Schema(
  {
    coating: { type: String, required: true },
    lensType: { type: String, required: true },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const WithdrawalSchemaObj = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    items: { type: [WithdrawalItemSchemaObj], required: true },
    totalQuantity: { type: Number, required: true },
    withdrawnAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const WithdrawalSchema = WithdrawalSchemaObj;
export const Withdrawal = model("Withdrawal", WithdrawalSchemaObj);
