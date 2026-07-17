import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const InventorySchemaObj = new Schema(
  {
    sku: { type: String, index: true, unique: true },
    category: { type: String, enum: ["Frame", "Lens", "Accessories"], default: "Frame" },
    inventoryType: { type: String, enum: ["spectacles", "sunglasses", "lens", "bifocal", "progressive", "blue-cut", "photochromic", "accessory", "hearing-aid", "cleaner", "case", "other"], default: "spectacles" },
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
    description: { type: String },
    lensIndex: { type: String },
    lensCoating: { type: String },
    sphRight: { type: String },
    cylRight: { type: String },
    axisRight: { type: String },
    sphLeft: { type: String },
    cylLeft: { type: String },
    axisLeft: { type: String },
    addPower: { type: String }
  },
  { timestamps: true }
);

export const InventorySchema = InventorySchemaObj;
const _Inventory = model("Inventory", InventorySchemaObj);
export const Inventory = withBranch(_Inventory, "Inventory");
