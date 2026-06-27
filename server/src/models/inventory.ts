import { Schema, model } from "mongoose";

const InventorySchema = new Schema(
  {
    sku: { type: String, index: true, unique: true },
    category: { type: String, enum: ["Frame", "Lens", "Accessories"], default: "Frame" },
    inventoryType: { type: String, enum: ["spectacles", "sunglasses", "lens", "accessory", "hearing-aid", "cleaner", "case", "other"], default: "spectacles" },
    brand: { type: String },
    model: { type: String },
    color: { type: String },
    size: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Unisex", ""], default: "" },
    supplier: { type: String },
    quantity: { type: Number, default: 0 },
    location: { type: String, enum: ["shop", "warehouse"], default: "shop" },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    description: { type: String }
  },
  { timestamps: true }
);

export const Inventory = model("Inventory", InventorySchema);
