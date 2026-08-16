import { Schema } from "mongoose";
import { prisma, type Prisma } from "../db/prisma";
import { scoped } from "../utils/scope";

const TodoSchemaObj = new Schema(
  {
    task: { type: String, required: true },
    done: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

export const TodoSchema = TodoSchemaObj;
export const Todo = scoped(prisma.todo) as Prisma.TodoDelegate;
