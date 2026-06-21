import { Schema, model, Types } from "mongoose";

const TodoSchema = new Schema(
  {
    task: { type: String, required: true },
    done: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Todo = model("Todo", TodoSchema);
