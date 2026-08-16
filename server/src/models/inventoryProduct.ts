import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";
import { VALID_PRODUCT_CATEGORIES, VALID_GENDERS } from "../types";

const InventoryProductSchemaObj = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", index: true },
    brandName: { type: String, default: "", index: true },
    category: { type: String, enum: VALID_PRODUCT_CATEGORIES, default: "Specs", index: true },
    inventoryType: { type: String, default: "" },
    model: { type: String, default: "", index: true },
    displayName: { type: String, default: "" },
    gender: { type: String, enum: VALID_GENDERS, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    sizeOptions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryProductSchemaObj.index({ brandId: 1, category: 1, model: 1 });
InventoryProductSchemaObj.index(
  { brandId: 1, model: 1 },
  { unique: true, partialFilterExpression: { model: { $type: "string", $ne: "" } } }
);

export const InventoryProductSchema = InventoryProductSchemaObj;
const _InventoryProduct = model("InventoryProduct", InventoryProductSchemaObj);
export const InventoryProduct = withBranch(_InventoryProduct, "InventoryProduct");
