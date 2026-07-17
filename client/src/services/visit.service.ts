import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Visit, PaginationParams, DateRangeParams } from "../types";

class VisitService extends ApiService {
  constructor() {
    super("/api/visits");
  }

  async listFiltered(params: PaginationParams & DateRangeParams & { customerId?: string }): Promise<ApiResponse<PaginatedResponse<Visit>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<Visit>>(`${this.basePath}${qs}`);
  }

  async getByCustomer(customerId: string): Promise<ApiResponse<Visit[]>> {
    return api.get<Visit[]>(`${this.basePath}?customerId=${customerId}`);
  }
}

export const visitService = new VisitService();
