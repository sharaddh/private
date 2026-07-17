import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Order, PaginationParams, DateRangeParams } from "../types";

class DeliveryService extends ApiService {
  constructor() {
    super("/api/deliveries");
  }

  async listReady(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Order>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<Order>>(`${this.basePath}/ready${qs}`);
  }

  async listDelivered(params?: PaginationParams & DateRangeParams): Promise<ApiResponse<PaginatedResponse<Order>>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<PaginatedResponse<Order>>(`${this.basePath}/delivered${qs}`);
  }

  async markDelivered(orderId: string, data?: { deliveryDate?: string; notes?: string }): Promise<ApiResponse<Order>> {
    return api.patch<Order>(`${this.basePath}/${orderId}/deliver`, data || {});
  }
}

export const deliveryService = new DeliveryService();
