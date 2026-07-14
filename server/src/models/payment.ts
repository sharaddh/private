import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const PaymentSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true },
    billId: { type: Types.ObjectId, ref: "Bill" },
    amount: { type: Number, required: true, min: [0.01, "Amount must be positive"] },
    paymentMode: { type: String, enum: ["Cash","UPI","Card","Bank Transfer","नकद","कार्ड","बैंक","बीमा","Insurance"], default: "Cash" },
    paymentDate: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { timestamps: true }
);

PaymentSchemaObj.index({ customerId: 1, paymentDate: -1 });
PaymentSchemaObj.index({ paymentDate: -1 });
PaymentSchemaObj.index({ billId: 1 });

export const PaymentSchema = PaymentSchemaObj;
const _Payment = model("Payment", PaymentSchemaObj);
export const Payment = withBranch(_Payment, "Payment");
