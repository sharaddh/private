import { Schema, model, Types } from "mongoose";

const OrderSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    frame: { type: String },
    frameBrand: { type: String },
    frameModel: { type: String },
    frameColor: { type: String },
    frameSize: { type: String },
    framePrice: { type: Number, default: 0 },
    lens: { type: String },
    lensBrand: { type: String },
    lensType: { type: String },
    lensIndex: { type: String },
    lensPrice: { type: Number, default: 0 },
    coating: { type: String },
    coatingPrice: { type: Number, default: 0 },
    accessories: { type: [String], default: [] },
    quantity: { type: Number, default: 1 },
    deliveryDate: { type: Date },
    status: { type: String, enum: ["Draft","Ordered","In Lab","Ready","Delivered","Cancelled"], default: "Draft" },
    labAssigned: { type: String },
    labExpectedDate: { type: Date },
    labRemarks: { type: String },
  reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Order = model("Order", OrderSchema);
