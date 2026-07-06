import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const DeliverySchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    address: { type: String },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
    status: { type: String, enum: ["Pending", "In Transit", "Ready", "Delivered", "Cancelled"], default: "Pending" }
  },
  { timestamps: true }
);

DeliverySchemaObj.index({ status: 1, expectedDeliveryDate: 1 });
DeliverySchemaObj.index({ orderId: 1 });

export const DeliverySchema = DeliverySchemaObj;
const _Delivery = model("Delivery", DeliverySchemaObj);
export const Delivery = withBranch(_Delivery, "Delivery");
