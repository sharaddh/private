import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, InventoryItem, PaginationParams, InventoryStats, InventoryImportResult } from "../types";

export interface InventoryListParams extends PaginationParams {
  category?: string;
  location?: string;
  lowStock?: boolean;
  threshold?: number;
}

class InventoryService extends ApiService {
  constructor() {
    super("/api/inventory");
  }

  async listFiltered(params: InventoryListParams): Promise<ApiResponse<PaginatedResponse<InventoryItem>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<InventoryItem>>(`${this.basePath}${qs}`);
  }

  async getStats(threshold?: number, location?: string): Promise<ApiResponse<InventoryStats>> {
    const params = new URLSearchParams();
    if (threshold) params.set("threshold", String(threshold));
    if (location) params.set("location", location);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return api.get<InventoryStats>(`${this.basePath}/stats${qs}`);
  }

  async checkSkuExists(sku: string): Promise<ApiResponse<{ exists: boolean; item?: InventoryItem }>> {
    return api.get<{ exists: boolean; item?: InventoryItem }>(`${this.basePath}/exists?sku=${encodeURIComponent(sku)}`);
  }

  async adjustStock(id: string, data: { quantity: number; note?: string }): Promise<ApiResponse<InventoryItem>> {
    return api.put<InventoryItem>(`${this.basePath}/${id}/stock`, { quantity: data.quantity, note: data.note });
  }

  async importItems(items: Array<Record<string, unknown>>, note?: string): Promise<ApiResponse<InventoryImportResult>> {
    return api.post<InventoryImportResult>(`${this.basePath}/import`, { items, note });
  }
}

export const inventoryService = new InventoryService();
