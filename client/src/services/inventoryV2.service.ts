import api from "../api";
import type { ApiResponse, PaginatedResponse } from "../types";
import { buildQueryString } from "./base";
import type {
  AddStockInput,
  AdjustStockInput,
  Brand,
  BrandDetail,
  BrandSummary,
  CompleteCountSessionInput,
  CountSession,
  CountSessionDetail,
  CreateBrandInput,
  CreateCountSessionInput,
  CreateProductInput,
  CreateRackInput,
  CreateVariantInput,
  CreateVariantWithStockInput,
  InventoryDashboard,
  InventoryProduct,
  InventoryVariant,
  MovementListParams,
  ProductDetail,
  ProductListParams,
  Rack,
  RackItems,
  UpdateBrandInput,
  UpdateCountEntriesInput,
  UpdateProductInput,
  UpdateRackInput,
  UpdateVariantInput,
  VariantDetail,
  VariantListParams,
  WithdrawalListParams,
  WithdrawalV2,
  WithdrawStockInput,
  InventoryMovement,
  InventoryLot,
} from "../types/inventoryV2";

export interface AddStockResult {
  variant: InventoryVariant;
  lot: InventoryLot;
}

export interface VariantWithStockResult {
  variant: InventoryVariant;
  lot: InventoryLot;
  product?: InventoryProduct | null;
  brand?: Brand | null;
}

export interface WithdrawResult {
  withdrawal: WithdrawalV2;
  movements: InventoryMovement[];
}

export interface AdjustStockResult {
  variant: InventoryVariant;
  movement: InventoryMovement;
}

export interface CreateCountSessionResult {
  session: CountSession;
  entries: Array<{ _id: string; variantId: string; sku: string; expectedQuantity: number; countedQuantity: number; difference: number }>;
}

export interface CompleteCountSessionResult {
  session: CountSession;
  corrections: number;
}

class InventoryV2Service {
  private base = "/api/inventory";

  // Dashboard
  getDashboard(threshold?: number): Promise<ApiResponse<InventoryDashboard>> {
    const qs = threshold !== undefined ? `?threshold=${threshold}` : "";
    return api.get<InventoryDashboard>(`${this.base}/dashboard${qs}`);
  }

  // Brands
  listBrands(threshold?: number): Promise<ApiResponse<BrandSummary[]>> {
    const qs = threshold !== undefined ? `?threshold=${threshold}` : "";
    return api.get<BrandSummary[]>(`${this.base}/brands${qs}`);
  }

  getBrandSummary(id: string): Promise<ApiResponse<BrandDetail>> {
    return api.get<BrandDetail>(`${this.base}/brands/${id}/summary`);
  }

  createBrand(data: CreateBrandInput): Promise<ApiResponse<Brand>> {
    return api.post<Brand>(`${this.base}/brands`, data);
  }

  updateBrand(id: string, data: UpdateBrandInput): Promise<ApiResponse<Brand>> {
    return api.patch<Brand>(`${this.base}/brands/${id}`, data);
  }

  // Products
  listProducts(params?: ProductListParams): Promise<ApiResponse<PaginatedResponse<InventoryProduct>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<InventoryProduct>>(`${this.base}/products${qs}`);
  }

  getProduct(id: string): Promise<ApiResponse<ProductDetail>> {
    return api.get<ProductDetail>(`${this.base}/products/${id}`);
  }

  createProduct(data: CreateProductInput): Promise<ApiResponse<InventoryProduct>> {
    return api.post<InventoryProduct>(`${this.base}/products`, data);
  }

  updateProduct(id: string, data: UpdateProductInput): Promise<ApiResponse<InventoryProduct>> {
    return api.patch<InventoryProduct>(`${this.base}/products/${id}`, data);
  }

  deleteProduct(id: string): Promise<ApiResponse<InventoryProduct | { deleted: boolean }>> {
    return api.del<InventoryProduct | { deleted: boolean }>(`${this.base}/products/${id}`);
  }

  // Variants
  searchVariants(q: string, limit?: number): Promise<ApiResponse<InventoryVariant[]>> {
    const params: Record<string, unknown> = { q };
    if (limit !== undefined) params.limit = limit;
    const qs = buildQueryString(params);
    return api.get<InventoryVariant[]>(`${this.base}/variants/search${qs}`);
  }

  getVariantBySku(sku: string): Promise<ApiResponse<InventoryVariant>> {
    return api.get<InventoryVariant>(`${this.base}/variants/by-sku/${encodeURIComponent(sku)}`);
  }

  listVariants(params?: VariantListParams): Promise<ApiResponse<PaginatedResponse<InventoryVariant>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<InventoryVariant>>(`${this.base}/variants${qs}`);
  }

  getVariant(id: string): Promise<ApiResponse<VariantDetail>> {
    return api.get<VariantDetail>(`${this.base}/variants/${id}`);
  }

  createVariant(data: CreateVariantInput): Promise<ApiResponse<InventoryVariant>> {
    return api.post<InventoryVariant>(`${this.base}/variants`, data);
  }

  updateVariant(id: string, data: UpdateVariantInput): Promise<ApiResponse<InventoryVariant>> {
    return api.patch<InventoryVariant>(`${this.base}/variants/${id}`, data);
  }

  deleteVariant(id: string): Promise<ApiResponse<InventoryVariant | { deleted: boolean }>> {
    return api.del<InventoryVariant | { deleted: boolean }>(`${this.base}/variants/${id}`);
  }

  createVariantWithStock(data: CreateVariantWithStockInput): Promise<ApiResponse<VariantWithStockResult>> {
    return api.post<VariantWithStockResult>(`${this.base}/variants/with-stock`, data);
  }

  // Stock
  addStock(data: AddStockInput): Promise<ApiResponse<AddStockResult>> {
    return api.post<AddStockResult>(`${this.base}/stock/add`, data);
  }

  adjustStock(id: string, data: AdjustStockInput): Promise<ApiResponse<AdjustStockResult>> {
    return api.put<AdjustStockResult>(`${this.base}/stock/${id}/adjust`, data);
  }

  // Withdrawals
  withdraw(data: WithdrawStockInput): Promise<ApiResponse<WithdrawResult>> {
    return api.post<WithdrawResult>(`${this.base}/withdraw`, data);
  }

  listWithdrawals(params?: WithdrawalListParams): Promise<ApiResponse<PaginatedResponse<WithdrawalV2>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<WithdrawalV2>>(`${this.base}/withdrawals${qs}`);
  }

  getWithdrawal(id: string): Promise<ApiResponse<WithdrawalV2>> {
    return api.get<WithdrawalV2>(`${this.base}/withdrawals/${id}`);
  }

  reverseWithdrawal(id: string): Promise<ApiResponse<WithdrawalV2>> {
    return api.post<WithdrawalV2>(`${this.base}/withdrawals/${id}/reverse`, {});
  }

  // Movements
  listMovements(params?: MovementListParams): Promise<ApiResponse<PaginatedResponse<InventoryMovement>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<InventoryMovement>>(`${this.base}/movements${qs}`);
  }

  // Racks
  listRacks(): Promise<ApiResponse<Rack[]>> {
    return api.get<Rack[]>(`${this.base}/racks`);
  }

  createRack(data: CreateRackInput): Promise<ApiResponse<Rack>> {
    return api.post<Rack>(`${this.base}/racks`, data);
  }

  updateRack(id: string, data: UpdateRackInput): Promise<ApiResponse<Rack>> {
    return api.patch<Rack>(`${this.base}/racks/${id}`, data);
  }

  getRackItems(id: string): Promise<ApiResponse<RackItems>> {
    return api.get<RackItems>(`${this.base}/racks/${id}/items`);
  }

  // Count sessions
  listCountSessions(params?: { page?: number; limit?: number }): Promise<ApiResponse<PaginatedResponse<CountSession>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<CountSession>>(`${this.base}/count-sessions${qs}`);
  }

  getCountSession(id: string): Promise<ApiResponse<CountSessionDetail>> {
    return api.get<CountSessionDetail>(`${this.base}/count-sessions/${id}`);
  }

  createCountSession(data: CreateCountSessionInput): Promise<ApiResponse<CreateCountSessionResult>> {
    return api.post<CreateCountSessionResult>(`${this.base}/count-sessions`, data);
  }

  updateCountEntries(id: string, data: UpdateCountEntriesInput): Promise<ApiResponse<CountSessionDetail>> {
    return api.post<CountSessionDetail>(`${this.base}/count-sessions/${id}/entries`, data);
  }

  completeCountSession(id: string, data: CompleteCountSessionInput): Promise<ApiResponse<CompleteCountSessionResult>> {
    return api.post<CompleteCountSessionResult>(`${this.base}/count-sessions/${id}/complete`, data);
  }

  cancelCountSession(id: string): Promise<ApiResponse<CountSession>> {
    return api.post<CountSession>(`${this.base}/count-sessions/${id}/cancel`, {});
  }
}

export const inventoryV2Service = new InventoryV2Service();
