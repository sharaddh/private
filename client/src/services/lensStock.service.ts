import api from "../api";
import type {
  ApiResponse,
  LensCartApi,
  LensStockItem,
  LensStockScope,
  LensType,
  ShopCartItem,
  ShopLensWithdrawal,
  ShopLensWithdrawalItemInput,
  WithdrawResult,
} from "../types";

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

  // ─── Shop lens cart (branch-scoped) ─────────────────────────────────────────

  async getCartItems(): Promise<ApiResponse<ShopCartItem[]>> {
    return api.get<ShopCartItem[]>("/api/lens-stock/cart");
  }

  async addToCart(coating: string, lensType: LensType, powerKey: string, quantity = 1): Promise<ApiResponse<ShopCartItem>> {
    return api.post<ShopCartItem>("/api/lens-stock/cart", { coating, lensType, powerKey, quantity });
  }

  async updateCartItem(id: string, quantity: number): Promise<ApiResponse<ShopCartItem>> {
    return api.put<ShopCartItem>(`/api/lens-stock/cart/${id}`, { quantity });
  }

  async removeCartItem(id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`/api/lens-stock/cart/${id}`);
  }

  async clearCart(): Promise<ApiResponse<null>> {
    return api.del<null>("/api/lens-stock/cart");
  }

  async withdrawCart(note?: string): Promise<ApiResponse<WithdrawResult>> {
    return api.post<WithdrawResult>("/api/lens-stock/cart/withdraw", { note });
  }

  async getWithdrawals(): Promise<ApiResponse<ShopLensWithdrawal[]>> {
    return api.get<ShopLensWithdrawal[]>("/api/lens-stock/withdrawals");
  }

  async updateWithdrawal(id: string, items: ShopLensWithdrawalItemInput[]): Promise<ApiResponse<ShopLensWithdrawal>> {
    return api.put<ShopLensWithdrawal>(`/api/lens-stock/withdrawals/${id}`, { items });
  }

  async deleteWithdrawal(id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`/api/lens-stock/withdrawals/${id}`);
  }

  // ─── Warehouse lens cart (kmj_warehouse) ────────────────────────────────────

  async warehouseGetCartItems(): Promise<ApiResponse<ShopCartItem[]>> {
    return api.get<ShopCartItem[]>("/api/cart");
  }

  async warehouseAddToCart(coating: string, lensType: LensType, powerKey: string, quantity = 1): Promise<ApiResponse<ShopCartItem>> {
    return api.post<ShopCartItem>("/api/cart", { coating, lensType, powerKey, quantity });
  }

  async warehouseUpdateCartItem(id: string, quantity: number): Promise<ApiResponse<ShopCartItem>> {
    return api.put<ShopCartItem>(`/api/cart/${id}`, { quantity });
  }

  async warehouseUpdateFogMark(id: string, fogMark: string): Promise<ApiResponse<ShopCartItem>> {
    return api.put<ShopCartItem>(`/api/cart/${id}`, { fogMark });
  }

  async warehouseRemoveCartItem(id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`/api/cart/${id}`);
  }

  async warehouseClearCart(): Promise<ApiResponse<null>> {
    return api.del<null>("/api/cart");
  }

  async warehouseWithdrawCart(): Promise<ApiResponse<WithdrawResult>> {
    return api.post<WithdrawResult>("/api/cart/withdraw", {});
  }

  async warehouseGetWithdrawals(): Promise<ApiResponse<ShopLensWithdrawal[]>> {
    return api.get<ShopLensWithdrawal[]>("/api/cart/withdrawals");
  }

  async warehouseUpdateWithdrawal(id: string, items: ShopLensWithdrawalItemInput[]): Promise<ApiResponse<ShopLensWithdrawal>> {
    return api.put<ShopLensWithdrawal>(`/api/cart/withdrawals/${id}`, { items });
  }

  async warehouseDeleteWithdrawal(id: string): Promise<ApiResponse<null>> {
    return api.del<null>(`/api/cart/withdrawals/${id}`);
  }
}

export const shopCartApi: LensCartApi = {
  getItems: () => lensStockService.getCartItems(),
  addItem: (coating, lensType, powerKey, quantity) => lensStockService.addToCart(coating, lensType, powerKey, quantity),
  updateItem: (id, quantity) => lensStockService.updateCartItem(id, quantity),
  removeItem: (id) => lensStockService.removeCartItem(id),
  clear: () => lensStockService.clearCart(),
  withdraw: (note) => lensStockService.withdrawCart(note),
  getWithdrawals: () => lensStockService.getWithdrawals(),
  updateWithdrawal: (id, items) => lensStockService.updateWithdrawal(id, items),
  deleteWithdrawal: (id) => lensStockService.deleteWithdrawal(id),
};

export const warehouseCartApi: LensCartApi = {
  getItems: () => lensStockService.warehouseGetCartItems(),
  addItem: (coating, lensType, powerKey, quantity) => lensStockService.warehouseAddToCart(coating, lensType, powerKey, quantity),
  updateItem: (id, quantity) => lensStockService.warehouseUpdateCartItem(id, quantity),
  updateFogMark: (id, fogMark) => lensStockService.warehouseUpdateFogMark(id, fogMark),
  removeItem: (id) => lensStockService.warehouseRemoveCartItem(id),
  clear: () => lensStockService.warehouseClearCart(),
  withdraw: () => lensStockService.warehouseWithdrawCart(),
  getWithdrawals: () => lensStockService.warehouseGetWithdrawals(),
  updateWithdrawal: (id, items) => lensStockService.warehouseUpdateWithdrawal(id, items),
  deleteWithdrawal: (id) => lensStockService.warehouseDeleteWithdrawal(id),
};

export const lensStockService = new LensStockService();
