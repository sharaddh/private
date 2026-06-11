import { Schema, model, Types } from "mongoose";

const PaymentSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true },
    billId: { type: Types.ObjectId, ref: "Bill" },
    amount: { type: Number, required: true },
    paymentMode: { type: String, enum: ["Cash","UPI","Card","Bank Transfer"], default: "Cash" },
    paymentDate: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { timestamps: true }
);

export const Payment = model("Payment", PaymentSchema);
