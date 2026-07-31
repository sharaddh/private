import { Schema, model, Types } from "mongoose";

const CartItemSchemaObj = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    coating: { type: String, required: true },
    lensType: { type: String, required: true, enum: ["sph", "cyl", "compound"] },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

CartItemSchemaObj.index({ user: 1, coating: 1, lensType: 1, powerKey: 1 }, { unique: true });

export const CartItemSchema = CartItemSchemaObj;
export const CartItem = model("CartItem", CartItemSchemaObj);
