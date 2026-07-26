import { Schema, model, Types } from "mongoose";

const CartItemSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    coating: { type: String, required: true },
    lensType: { type: String, required: true, enum: ["sph", "cyl", "compound"] },
    powerKey: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { timestamps: true }
);

CartItemSchema.index({ user: 1, coating: 1, lensType: 1, powerKey: 1 }, { unique: true });

export const CartItem = model("CartItem", CartItemSchema);
