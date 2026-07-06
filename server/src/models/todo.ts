import { Schema, model, Types } from "mongoose";
import { withBranch } from "../utils/branchProxy";

const TodoSchemaObj = new Schema(
  {
    task: { type: String, required: true },
    done: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

export const TodoSchema = TodoSchemaObj;
const _Todo = model("Todo", TodoSchemaObj);
export const Todo = withBranch(_Todo, "Todo");
