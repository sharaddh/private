import { Request } from "express";
import type { BranchModels } from "../models/db";

export interface JwtPayload {
  sub: string;
  username: string;
  role?: string;
  branchId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface BranchRequest extends AuthRequest {
  branchId?: string;
  branchDb?: string;
  branchName?: string;
  branchModels?: BranchModels;
}

export interface PaginatedQuery {
  page?: string;
  limit?: string;
  cursor?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
  dateField?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface BillItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface EyeData {
  sph?: number;
  cyl?: number;
  axis?: number;
  va?: string;
}

export const VALID_ORDER_STATUSES = ["Draft", "Ordered", "In Lab", "Ready", "Delivered", "Cancelled"] as const;
export type OrderStatus = typeof VALID_ORDER_STATUSES[number];

export const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  Draft: ["Ordered", "Cancelled"],
  Ordered: ["In Lab", "Cancelled"],
  "In Lab": ["Ready", "Cancelled"],
  Ready: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
} as const;

export const VALID_CLASSIFICATIONS = ["pending", "stock", "buy", "order"] as const;
export const VALID_PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "नकद", "कार्ड", "बैंक", "बीमा", "Insurance"] as const;
export const VALID_VISIT_TYPES = ["new", "frame_change", "new_lens", "contact_lens", "service", "other"] as const;
export const VALID_DELIVERY_STATUSES = ["Pending", "In Transit", "Ready", "Delivered", "Cancelled"] as const;
export const VALID_BILL_STATUSES = ["Active", "Cancelled"] as const;
export const VALID_USER_ROLES = ["owner", "staff", "warehouse"] as const;
export const VALID_INVENTORY_CATEGORIES = ["Frame", "Lens", "Accessories"] as const;
export const VALID_INVENTORY_TYPES = ["spectacles", "sunglasses", "lens", "accessory", "hearing-aid", "cleaner", "case", "other"] as const;
export const VALID_GENDERS = ["Male", "Female", "Unisex", ""] as const;
export const VALID_LOCATIONS = ["shop", "warehouse"] as const;
