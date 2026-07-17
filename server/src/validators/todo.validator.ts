import { z } from "zod";

export const createTodoSchema = z.object({
  task: z.string().min(1, "Task is required"),
  notes: z.string().optional(),
});

export const updateTodoSchema = z.object({
  task: z.string().optional(),
  done: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();
