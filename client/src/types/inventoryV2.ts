import type { PaginationParams } from './index';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  'Specs',
  'Sunglasses',
  'Contact Lens',
  'Hearing Aid',
  'Solution',
  'Kit',
  'Accessory',
  'Other',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const GENDERS = ['Male', 'Female', 'Unisex', ''] as const;
export type Gender = (typeof GENDERS)[number];

export const MOVEMENT_TYPES = [
  'OPENING_BALANCE',
  'PURCHASE',
  'ORDER',
  'WITHDRAWAL',
  'RETURN',
  'DAMAGE',
  'ADJUSTMENT',
  'COUNT_CORRECTION',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOCATION_CHANGE',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  OPENING_BALANCE: 'Opening Balance',
  PURCHASE: 'Purchase',
  ORDER: 'Order',
  WITHDRAWAL: 'Withdrawal',
  RETURN: 'Return',
  DAMAGE: 'Damage',
  ADJUSTMENT: 'Adjustment',
  COUNT_CORRECTION: 'Count Correction',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  LOCATION_CHANGE: 'Location Change',
};

export const WITHDRAWAL_REASONS = [
  'Demo',
  'Damaged',
  'Internal Use',
  'Sample',
  'Lost',
  'Customer Return to Non-Sellable',
  'Stock Correction',
  'Other',
] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

export const COUNT_STATUSES = ['draft', 'completed', 'cancelled'] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  draft: 'Draft',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const LOT_SOURCES = ['OPENING_BALANCE', 'PURCHASE', 'ADJUSTMENT', 'RETURN'] as const;
export type LotSource = (typeof LOT_SOURCES)[number];

// ─── Brand ───────────────────────────────────────────────────────────────────

export interface Brand {
  _id: string;
  name: string;
  description?: string;
  logo?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandSummary {
  _id: string;
  name: string;
  variants: number;
  units: number;
  lowStock: number;
}

export interface BrandDetail {
  brand: Brand;
  categoryCounts: Record<string, number>;
  variants: number;
  units: number;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
  logo?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string;
  logo?: string;
  active?: boolean;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface InventoryProduct {
  _id: string;
  brandId?: string;
  brandName: string;
  category: string;
  inventoryType?: string;
  model: string;
  displayName?: string;
  gender?: string;
  description?: string;
  image?: string;
  sizeOptions?: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductDetail {
  _id: string;
  brandId?: string;
  brandName: string;
  category: string;
  inventoryType?: string;
  model: string;
  displayName?: string;
  gender?: string;
  description?: string;
  image?: string;
  sizeOptions?: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  variants: InventoryVariant[];
}

export interface CreateProductInput {
  brandId?: string;
  brandName?: string;
  category?: ProductCategory;
  inventoryType?: string;
  model: string;
  gender?: Gender;
  description?: string;
}

export interface UpdateProductInput {
  category?: ProductCategory;
  inventoryType?: string;
  model?: string;
  gender?: Gender;
  description?: string;
  image?: string;
  active?: boolean;
  sizeOptions?: string[];
}

export interface ProductListParams extends PaginationParams {
  brandId?: string;
  category?: string;
  gender?: string;
}

// ─── Variant ─────────────────────────────────────────────────────────────────

export interface InventoryVariant {
  _id: string;
  productId?: string;
  brandId?: string;
  brandName: string;
  category: string;
  model: string;
  gender?: string;
  sku: string;
  variantCode?: string;
  color: string;
  size: string;
  material: string;
  frameShape: string;
  frameType?: string;
  templeSize?: string;
  bridgeSize?: string;
  lensWidth?: string;
  status?: string;
  attributes?: Record<string, unknown>;
  image?: string;
  stockQuantity: number;
  defaultSellingPrice: number;
  rackId?: string;
  rackLabel: string;
  supplierId?: string;
  supplierName: string;
  lastSoldAt?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VariantDetail {
  variant: InventoryVariant;
  product?: InventoryProduct | null;
  rack?: { _id: string; code: string; name?: string } | null;
  lots: InventoryLot[];
  recentMovements: InventoryMovement[];
}

export interface CreateVariantInput {
  productId?: string;
  brandId?: string;
  brandName?: string;
  category?: string;
  model?: string;
  gender?: Gender;
  sku: string;
  color?: string;
  size?: string;
  material?: string;
  frameShape?: string;
  frameType?: string;
  templeSize?: string;
  bridgeSize?: string;
  lensWidth?: string;
  status?: string;
  defaultSellingPrice?: number;
  rackId?: string;
  supplierId?: string;
  supplierName?: string;
  attributes?: Record<string, unknown>;
  image?: string;
}

export interface UpdateVariantInput {
  color?: string;
  size?: string;
  gender?: Gender;
  material?: string;
  frameShape?: string;
  frameType?: string;
  templeSize?: string;
  bridgeSize?: string;
  lensWidth?: string;
  status?: string;
  defaultSellingPrice?: number;
  rackId?: string | null;
  supplierId?: string;
  supplierName?: string;
  attributes?: Record<string, unknown>;
  image?: string;
  active?: boolean;
}

export interface VariantListParams extends PaginationParams {
  productId?: string;
  brandId?: string;
  category?: string;
  color?: string;
  rackId?: string;
  gender?: string;
  stock?: 'all' | 'in' | 'low' | 'out';
  threshold?: number;
}

// ─── Lot ─────────────────────────────────────────────────────────────────────

export interface LotBreakdown {
  lotId: string;
  quantity: number;
}

export interface InventoryLot {
  _id: string;
  variantId: string;
  lotNumber: string;
  initialQuantity: number;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  supplierId?: string;
  supplierName: string;
  rackId?: string;
  rackLabel: string;
  purchaseDate?: string;
  batchNumber: string;
  expiryDate?: string;
  source: LotSource;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Movement ────────────────────────────────────────────────────────────────

export interface InventoryMovement {
  _id: string;
  variantId?: string;
  sku: string;
  lotId?: string;
  lotBreakdown: LotBreakdown[];
  type: MovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceType: string;
  referenceId?: string;
  note: string;
  by: string;
  performedBy?: string;
  rackId?: string;
  rackLabel: string;
  oldRackId?: string;
  newRackId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MovementListParams extends PaginationParams {
  variantId?: string;
  sku?: string;
  type?: string;
  user?: string;
  rack?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Withdrawal ──────────────────────────────────────────────────────────────

export interface WithdrawalItemV2 {
  variantId: string;
  sku: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  lotId?: string;
  lotBreakdown: LotBreakdown[];
  quantity: number;
  price: number;
}

export interface WithdrawalV2 {
  _id: string;
  items: WithdrawalItemV2[];
  reason: WithdrawalReason;
  note: string;
  by: string;
  totalQty: number;
  totalPrice: number;
  reversed: boolean;
  reversedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WithdrawStockInput {
  items: Array<{ variantId: string; quantity: number; lotId?: string }>;
  reason?: WithdrawalReason;
  note?: string;
}

export interface WithdrawalListParams extends PaginationParams {
  reason?: string;
  by?: string;
}

// ─── Rack ────────────────────────────────────────────────────────────────────

export interface Rack {
  _id: string;
  name: string;
  code: string;
  section: string;
  description?: string;
  active?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  variants?: number;
  units?: number;
}

export interface RackItems {
  rack: Rack;
  items: InventoryVariant[];
}

export interface CreateRackInput {
  name?: string;
  code: string;
  section?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateRackInput {
  name?: string;
  code?: string;
  section?: string;
  description?: string;
  sortOrder?: number;
  active?: boolean;
}

// ─── Count Sessions ──────────────────────────────────────────────────────────

export interface CountSession {
  _id: string;
  rackId: string;
  rackLabel?: string;
  status: CountStatus;
  startedBy: string;
  completedBy?: string;
  startedAt: string;
  completedAt?: string;
  expectedUnits: number;
  countedUnits: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CountEntry {
  _id: string;
  countSessionId: string;
  variantId: string;
  sku: string;
  brandName?: string;
  model?: string;
  color?: string;
  size?: string;
  lotId?: string;
  expectedQuantity: number;
  countedQuantity: number;
  difference: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CountSessionDetail {
  session: CountSession;
  entries: CountEntry[];
}

export interface CreateCountSessionInput {
  rackId: string;
  note?: string;
}

export interface UpdateCountEntriesInput {
  entries: Array<{ variantId: string; countedQuantity: number }>;
}

export interface CompleteCountSessionInput {
  note?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface InventoryDashboard {
  products: number;
  variants: number;
  stockUnits: number;
  lowStock: number;
  outOfStock: number;
  brands: number;
  inventoryCost: number;
  inventoryValue: number;
  lowStockThreshold: number;
  recentActivity: InventoryMovement[];
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export interface AddStockInput {
  variantId: string;
  quantity: number;
  purchasePrice?: number;
  sellingPrice?: number;
  supplierId?: string;
  supplierName?: string;
  rackId?: string;
  purchaseDate?: string;
  batchNumber?: string;
  expiryDate?: string;
  note?: string;
}

export interface CreateVariantWithStockInput {
  brand?: string;
  brandId?: string;
  category?: string;
  inventoryType?: string;
  model: string;
  gender?: string;
  color?: string;
  size?: string;
  sku: string;
  quantity: number;
  purchasePrice?: number;
  sellingPrice?: number;
  rackId?: string;
  supplierId?: string;
  supplierName?: string;
  material?: string;
  frameShape?: string;
  frameType?: string;
  templeSize?: string;
  bridgeSize?: string;
  lensWidth?: string;
  purchaseDate?: string;
  batchNumber?: string;
  expiryDate?: string;
  note?: string;
  attributes?: Record<string, unknown>;
}

export interface AdjustStockInput {
  quantity: number;
  note?: string;
}
