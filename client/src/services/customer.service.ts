import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Customer, PaginationParams } from "../types";

class CustomerService extends ApiService {
  constructor() {
    super("/api/customers");
  }

  async search(search: string, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Customer>>> {
    const qs = buildQueryString({ search, ...params });
    return api.get<PaginatedResponse<Customer>>(`${this.basePath}${qs}`);
  }

  async getStats(id: string): Promise<ApiResponse<{ totalVisits: number; totalSpent: number; pendingAmount: number }>> {
    return api.get(`${this.basePath}/${id}/stats`);
  }
}

export const customerService = new CustomerService();
