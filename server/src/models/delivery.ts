import { Schema, model, Types } from "mongoose";

const DeliverySchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
    status: { type: String, enum: ["Pending","Ready","Delivered"], default: "Pending" }
  },
  { timestamps: true }
);

export const Delivery = model("Delivery", DeliverySchema);
