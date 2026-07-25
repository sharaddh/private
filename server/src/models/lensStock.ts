import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const LensStockSchemaObj = new Schema(
  {
    coating: { type: String, required: true },
    quantities: {
      type: Schema.Types.Mixed,
      default: { sph: {}, cyl: {}, compound: {} },
    },
  },
  { timestamps: true }
);

LensStockSchemaObj.index({ coating: 1 }, { unique: true });

export const LensStockSchema = LensStockSchemaObj;
const _LensStock = model("LensStock", LensStockSchemaObj);
export const LensStock = withBranch(_LensStock, "LensStock");
