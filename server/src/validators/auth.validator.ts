import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  name: z.string().optional(),
  mobile: z.string().optional(),
  role: z.enum(["staff", "warehouse"]).optional(),
  branchId: z.string().optional(),
  branches: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  branchId: z.string().optional(),
});

export const refreshSchema = z.object({
  refresh: z.string().min(1, "Refresh token is required"),
});

export const updateMeSchema = z.object({
  name: z.string().optional(),
  mobile: z.string().optional(),
  password: z.string().min(6).optional(),
});

export const updateUserSchema = z.object({
  branches: z.array(z.string()).optional(),
  name: z.string().optional(),
  mobile: z.string().optional(),
});
