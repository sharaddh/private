import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const CustomerSchemaObj = new Schema(
  {
    customerId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    email: { type: String },
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

CustomerSchemaObj.index({ totalSpent: -1 });
CustomerSchemaObj.index({ createdAt: -1 });
CustomerSchemaObj.index({ name: "text", mobile: "text" });

export const CustomerSchema = CustomerSchemaObj;
const _Customer = model("Customer", CustomerSchemaObj);
export const Customer = withBranch(_Customer, "Customer");
