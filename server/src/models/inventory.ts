import { Schema, model } from "mongoose";

const InventorySchema = new Schema(
  {
    sku: { type: String, index: true, unique: true },
    category: { type: String },
    brand: { type: String },
    model: { type: String },
    color: { type: String },
    size: { type: String },
    quantity: { type: Number, default: 0 },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Inventory = model("Inventory", InventorySchema);
