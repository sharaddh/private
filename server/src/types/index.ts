import { Request } from "express";

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

export const VALID_ORDER_STATUSES = [
  "Draft",
  "Ordered",
  "In Lab",
  "Ready",
  "Delivered",
  "Cancelled",
] as const;
export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  Draft: ["Ordered", "Cancelled"],
  Ordered: ["In Lab", "Cancelled"],
  "In Lab": ["Ready", "Cancelled"],
  Ready: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
} as const;

export const VALID_CLASSIFICATIONS = ["pending", "stock", "buy", "order"] as const;
export const VALID_PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Insurance"] as const;
export const VALID_VISIT_TYPES = [
  "new",
  "frame_change",
  "new_lens",
  "contact_lens",
  "service",
  "other",
] as const;
export const VALID_DELIVERY_STATUSES = [
  "Pending",
  "In Transit",
  "Ready",
  "Delivered",
  "Cancelled",
] as const;
export const VALID_BILL_STATUSES = ["Active", "Cancelled"] as const;
export const VALID_USER_ROLES = ["owner", "staff"] as const;
export const VALID_INVENTORY_CATEGORIES = [
  "Specs",
  "Sunglasses",
  "Contact Lens",
  "Hearing Aid",
  "Solution",
  "Kit",
] as const;
export const VALID_INVENTORY_TYPES = [
  "spectacles",
  "sunglasses",
  "lens",
  "accessory",
  "hearing-aid",
  "cleaner",
  "case",
  "other",
] as const;
export const VALID_GENDERS = ["Male", "Female", "Unisex", ""] as const;
export const VALID_LOCATIONS = ["shop", "warehouse"] as const;

export const VALID_PRODUCT_CATEGORIES = [
  "Specs",
  "Sunglasses",
  "Contact Lens",
  "Hearing Aid",
  "Solution",
  "Kit",
  "Accessory",
  "Other",
] as const;
export type ProductCategory = (typeof VALID_PRODUCT_CATEGORIES)[number];

export const VALID_INVENTORY_MOVEMENT_TYPES = [
  "OPENING_BALANCE",
  "PURCHASE",
  "ORDER",
  "WITHDRAWAL",
  "RETURN",
  "DAMAGE",
  "ADJUSTMENT",
  "COUNT_CORRECTION",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOCATION_CHANGE",
] as const;
export type InventoryMovementType = (typeof VALID_INVENTORY_MOVEMENT_TYPES)[number];

export const VALID_WITHDRAWAL_REASONS = [
  "Demo",
  "Damaged",
  "Internal Use",
  "Sample",
  "Lost",
  "Customer Return to Non-Sellable",
  "Stock Correction",
  "Other",
] as const;
export type WithdrawalReason = (typeof VALID_WITHDRAWAL_REASONS)[number];

export const VALID_COUNT_STATUSES = ["draft", "completed", "cancelled"] as const;
export type CountStatus = (typeof VALID_COUNT_STATUSES)[number];

export const VALID_LOT_SOURCES = ["OPENING_BALANCE", "PURCHASE", "ADJUSTMENT", "RETURN"] as const;
export const VALID_MOVEMENT_REFERENCES = [
  "ORDER",
  "WITHDRAWAL",
  "COUNT_SESSION",
  "MANUAL",
  "IMPORT",
] as const;
