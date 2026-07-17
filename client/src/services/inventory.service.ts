import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, InventoryItem, PaginationParams } from "../types";

class InventoryService extends ApiService {
  constructor() {
    super("/api/inventory");
  }

  async listFiltered(params: PaginationParams & { category?: string; location?: string; brand?: string }): Promise<ApiResponse<PaginatedResponse<InventoryItem>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<InventoryItem>>(`${this.basePath}${qs}`);
  }

  async adjustStock(id: string, data: { quantity: number; note: string }): Promise<ApiResponse<InventoryItem>> {
    return api.patch<InventoryItem>(`${this.basePath}/${id}/adjust`, data);
  }

  async getLowStock(threshold?: number): Promise<ApiResponse<InventoryItem[]>> {
    const qs = threshold ? `?threshold=${threshold}` : "";
    return api.get<InventoryItem[]>(`${this.basePath}/low-stock${qs}`);
  }

  async scan(code: string): Promise<ApiResponse<InventoryItem>> {
    return api.get<InventoryItem>(`${this.basePath}/scan/${code}`);
  }
}

export const inventoryService = new InventoryService();
