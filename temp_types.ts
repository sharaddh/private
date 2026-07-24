// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
  nextCursor: string | null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  username: string;
  name?: string;
  mobile?: string;
  role: "owner" | "staff" | "warehouse";
  branches: BranchInfo[];
  createdAt?: string;
}

export interface BranchInfo {
  _id: string;
  name: string;
  code: string;
  dbName: string;
  isActive: boolean;
  settings?: {
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    shopEmail?: string;
    adminWhatsApp?: string;
    logo?: string;
  };
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  _id: string;
  customerId: string;
  name: string;
  email?: string;
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  age?: number;
  gender?: string;
  tags?: string[];
  totalVisits?: number;
  totalSpent?: number;
  pendingAmount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerFormData {
  name: string;
  email: string;
  mobile: string;
  alternateMobile: string;
  address: string;
  city: string;
  age: string;
  gender: string;
  tags: string;
}

// ─── Visit ───────────────────────────────────────────────────────────────────

export type VisitType = "new" | "frame_change" | "new_lens" | "contact_lens" | "service" | "other";

export interface EyeData {
  sph?: number;
  cyl?: number;
  axis?: number;
  va?: string;
  pc?: Record<string, unknown>;
}

export interface Prescription {
  rightEye: { dv: Partial<EyeData>; nv: Partial<EyeData>; pc?: Record<string, unknown> };
  leftEye: { dv: Partial<EyeData>; nv: Partial<EyeData>; pc?: Record<string, unknown> };
  pd?: string;
  nearPD?: string;
  notes?: string;
}

export interface Visit {
  _id: string;
  customerId: string;
  visitType: VisitType;
  visitDate: string;
  prescription?: Prescription;
  notes?: string;
  doctorName?: string;
  createdAt: string;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export type OrderStatus = "Draft" | "Ordered" | "In Lab" | "Ready" | "Delivered" | "Cancelled";

export type OrderClassification = "pending" | "stock" | "buy" | "order";

export interface OrderItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface StockStatus {
  lensBrand?: { shop: number; warehouse: number } | null;
  frameBrand?: { shop: number; warehouse: number } | null;
}

export interface Order {
  _id: string;
  customerId: string | { _id: string; name: string; mobile: string };
  visitId?: string;
  status: OrderStatus;
  classification?: OrderClassification;
  quantity?: number;
  forwardedCount?: number;
  frameBrand?: string;
  frameModel?: string;
  frameColor?: string;
  frameSize?: string;
  lensBrand?: string;
  lensType?: string;
  lensIndex?: string;
  lensMaterial?: string;
  coating?: string;
  tint?: string;
  rightLensStatus?: string;
  leftLensStatus?: string;
  prescription?: Prescription;
  stockStatus?: StockStatus;
  billInfo?: { totalAmount: number; pendingAmount: number };
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Bill ────────────────────────────────────────────────────────────────────

export type BillStatus = "Active" | "Cancelled";

export interface BillItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface Bill {
  _id: string;
  customerId: string | { _id: string; name: string; mobile: string; address?: string };
  visitId?: string;
  billNumber: string;
  status: BillStatus;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  advancePaid: number;
  pendingAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentMode = "Cash" | "UPI" | "Card" | "Bank Transfer" | "नकद" | "कार्ड" | "बैंक" | "बीमा" | "Insurance";

export interface Payment {
  _id: string;
  customerId: string | { _id: string; name: string; mobile: string };
  billId?: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type InventoryCategory = "Frame" | "Lens" | "Accessories";

export type InventoryType = "spectacles" | "sunglasses" | "lens" | "bifocal" | "progressive" | "blue-cut" | "photochromic" | "accessory" | "hearing-aid" | "cleaner" | "case" | "other";

export type InventoryLocation = "shop" | "warehouse";

export type InventoryGender = "Male" | "Female" | "Unisex" | "";

export interface InventoryItem {
  _id: string;
  sku: string;
  category: InventoryCategory;
  inventoryType: InventoryType;
  brand: string;
  model: string;
  color: string;
  size: string;
  gender: InventoryGender;
  supplier: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  description: string;
  location: InventoryLocation;
  lensIndex: string;
  lensCoating: string;
  sphRight: string;
  cylRight: string;
  axisRight: string;
  sphLeft: string;
  cylLeft: string;
  axisLeft: string;
  addPower: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryFormData {
  sku: string;
  category: string;
  inventoryType: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  gender: string;
  supplier: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  description: string;
  location: string;
  lensIndex: string;
  lensCoating: string;
  sphRight: string;
  cylRight: string;
  axisRight: string;
  sphLeft: string;
  cylLeft: string;
  axisLeft: string;
  addPower: string;
}

// ─── Delivery ────────────────────────────────────────────────────────────────

export type DeliveryStatus = "Pending" | "In Transit" | "Ready" | "Delivered" | "Cancelled";

export interface Delivery {
  _id: string;
  orderId: string;
  customerId: string | { _id: string; name: string; mobile: string };
  status: DeliveryStatus;
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
}

// ─── Announcement ────────────────────────────────────────────────────────────

export interface Announcement {
  _id: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  expiresAt?: string;
}

// ─── Todo ────────────────────────────────────────────────────────────────────

export interface Todo {
  _id: string;
  task: string;
  done: boolean;
  createdAt: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  logo: string;
  taxRate: number;
  currency: string;
  invoicePrefix: string;
  lowStockThreshold: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardCounts {
  customers: number;
  orders: number;
  bills: number;
  payments: number;
  inventory: number;
  deliveries: number;
  visits: number;
}

export interface DashboardData {
  counts: DashboardCounts;
  todaySales: number;
  todayCollection: number;
  weekSales: number;
  monthSales: number;
  readyDeliveries: number;
  newCustomersToday: number;
  lowStock: number;
  pendingPayments: number;
  recentCustomers: Customer[];
  recentOrders: Order[];
  todayDeliveries: Order[];
  pendingBills: Bill[];
  incompleteOrders: Order[];
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  todayBills: number;
  weekBills: number;
  monthBills: number;
  dailySales: { date: string; total: number }[];
  paymentModeSplit: { mode: string; total: number; count: number }[];
  orderStatusCounts: { status: string; count: number }[];
  salesTrend: string;
  collectionTrend: { value: number; direction: "up" | "down" | "flat" };
  todayDeliveredOrders: Order[];
  dailyCollections: { date: string; total: number }[];
  weeklyOrderTrend: { date: string; count: number }[];
  categoryBreakdown: { category: string; count: number; totalValue: number }[];
  todayPaymentModeSplit: { mode: string; total: number; count: number }[];
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportData {
  dailySales: { date: string; total: number }[];
  monthlySales: { month: string; total: number }[];
  topCustomers: Customer[];
  paymentModeSplit: { mode: string; total: number; count: number }[];
  orderStatusCounts: { status: string; count: number }[];
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  to: string;
  message: string;
  template?: string;
}

// ─── Query Params ────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export type OrderStatusType = OrderStatus;
