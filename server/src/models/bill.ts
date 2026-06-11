import { Schema, model, Types } from "mongoose";

const BillItemSchema = new Schema({
  description: { type: String },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
});

const BillSchema = new Schema(
  {
    billNumber: { type: String, index: true, unique: true },
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    items: { type: [BillItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["Active","Cancelled"], default: "Active" }
  },
  { timestamps: true }
);

export const Bill = model("Bill", BillSchema);
