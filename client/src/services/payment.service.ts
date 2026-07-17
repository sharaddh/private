import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Payment, PaymentMode, PaginationParams, DateRangeParams } from "../types";

class PaymentService extends ApiService {
  constructor() {
    super("/api/payments");
  }

  async listFiltered(params: PaginationParams & DateRangeParams & { paymentMode?: PaymentMode }): Promise<ApiResponse<PaginatedResponse<Payment>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<Payment>>(`${this.basePath}${qs}`);
  }

  async getSummary(params?: DateRangeParams): Promise<ApiResponse<{
    total: number;
    byMode: { mode: string; total: number; count: number }[];
  }>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get(`${this.basePath}/summary${qs}`);
  }
}

export const paymentService = new PaymentService();
