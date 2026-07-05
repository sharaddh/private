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
  forwardedCount: { type: Number, default: 0 },
  deliveryDate: { type: Date },
  status: { type: String, enum: ["Draft","Ordered","In Lab","Ready","Delivered","Cancelled"], default: "Draft" },
    labAssigned: { type: String },
    labExpectedDate: { type: Date },
    labRemarks: { type: String },
  reviewed: { type: Boolean, default: false },
  classification: { type: String, enum: ["pending", "stock", "buy", "order"], default: "pending" },
  rightLensStatus: { type: String, enum: ["pending", "stock", "buy", "order"], default: "pending" },
  leftLensStatus: { type: String, enum: ["pending", "stock", "buy", "order"], default: "pending" },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ classification: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

export const Order = model("Order", OrderSchema);
