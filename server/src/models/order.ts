import { Schema, model, Types } from "mongoose";

const OrderSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    frame: { type: String },
    lens: { type: String },
    coating: { type: String },
    accessories: { type: [String], default: [] },
    quantity: { type: Number, default: 1 },
    deliveryDate: { type: Date },
    status: { type: String, enum: ["Draft","Ordered","In Lab","Ready","Delivered","Cancelled"], default: "Draft" }
  },
  { timestamps: true }
);

export const Order = model("Order", OrderSchema);
