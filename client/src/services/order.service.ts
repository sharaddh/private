import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Order, OrderStatus, PaginationParams, DateRangeParams } from "../types";

class OrderService extends ApiService {
  constructor() {
    super("/api/orders");
  }

  async listFiltered(params: PaginationParams & DateRangeParams & { status?: string }): Promise<ApiResponse<PaginatedResponse<Order>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<Order>>(`${this.basePath}${qs}`);
  }

  async advanceStatus(id: string, status: OrderStatus, advanceQuantity?: number): Promise<ApiResponse<Order & { partial?: boolean }>> {
    return api.patch<Order & { partial?: boolean }>(`${this.basePath}/${id}/status`, { status, advanceQuantity });
  }

  async getStockStatus(id: string): Promise<ApiResponse<Order["stockStatus"]>> {
    return api.get(`${this.basePath}/${id}/stock-status`);
  }

  async getIncomplete(params?: PaginationParams): Promise<ApiResponse<Order[]>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<Order[]>(`${this.basePath}/incomplete${qs}`);
  }
}

export const orderService = new OrderService();
