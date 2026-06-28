import { Schema, model } from "mongoose";

const CustomerSchema = new Schema(
  {
    customerId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    age: { type: Number },
    gender: { type: String },
    mobile: { type: String, index: true },
    alternateMobile: { type: String },
    address: { type: String },
    city: { type: String },
    tags: { type: [String], default: [] },
    totalVisits: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

CustomerSchema.index({ totalSpent: -1 });
CustomerSchema.index({ createdAt: -1 });

export const Customer = model("Customer", CustomerSchema);
