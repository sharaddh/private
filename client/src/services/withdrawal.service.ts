import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Withdrawal, CreateWithdrawalInput, PaginationParams } from "../types";

class WithdrawalService extends ApiService {
  constructor() {
    super("/api/withdrawals");
  }

  async listFiltered(params: PaginationParams): Promise<ApiResponse<PaginatedResponse<Withdrawal>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<Withdrawal>>(`${this.basePath}${qs}`);
  }

  async createWithdrawal(data: CreateWithdrawalInput): Promise<ApiResponse<Withdrawal>> {
    return api.post<Withdrawal>(this.basePath, data);
  }
}

export const withdrawalService = new WithdrawalService();
