import api from "../api";
import type { ApiResponse, LensStockItem, LensStockScope, LensType } from "../types";

class LensStockService {
  private base(scope: LensStockScope): string {
    return scope === "warehouse" ? "/api/warehouse/lens-stock" : "/api/lens-stock";
  }

  async list(scope: LensStockScope): Promise<ApiResponse<LensStockItem[]>> {
    const path = scope === "warehouse" ? "/api/warehouse/lens-stock/list" : "/api/lens-stock";
    return api.get<LensStockItem[]>(path);
  }

  async create(scope: LensStockScope, data: { coating: string; priceNeg?: number; pricePos?: number }): Promise<ApiResponse<LensStockItem>> {
    return api.post<LensStockItem>(this.base(scope), data);
  }

  async rename(scope: LensStockScope, id: string, data: { coating: string; priceNeg?: number; pricePos?: number }): Promise<ApiResponse<LensStockItem>> {
    return api.put<LensStockItem>(`${this.base(scope)}/${id}`, data);
  }

  async remove(scope: LensStockScope, id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`${this.base(scope)}/${id}`);
  }

  async updateQuantity(
    scope: LensStockScope,
    id: string,
    lensType: LensType,
    powerKey: string,
    quantity: number
  ): Promise<ApiResponse<LensStockItem>> {
    return api.put<LensStockItem>(`${this.base(scope)}/${id}/quantity`, { lensType, powerKey, quantity });
  }
}

export const lensStockService = new LensStockService();
