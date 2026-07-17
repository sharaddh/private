import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, PaginatedResponse, Bill, BillItem, PaginationParams, DateRangeParams } from "../types";

class BillService extends ApiService {
  constructor() {
    super("/api/bills");
  }

  async listFiltered(params: PaginationParams & DateRangeParams & { status?: string }): Promise<ApiResponse<PaginatedResponse<Bill>>> {
    const qs = buildQueryString(params);
    return api.get<PaginatedResponse<Bill>>(`${this.basePath}${qs}`);
  }

  async createWithItems(data: {
    customerId: string;
    items: BillItem[];
    discount?: number;
    tax?: number;
    advancePaid?: number;
    notes?: string;
  }): Promise<ApiResponse<Bill>> {
    return api.post<Bill>(this.basePath, data);
  }

  async cancel(id: string): Promise<ApiResponse<Bill>> {
    return api.patch<Bill>(`${this.basePath}/${id}/cancel`, {});
  }

  async generatePdf(id: string): Promise<Blob> {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}${this.basePath}/${id}/pdf`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        "x-branch-id": localStorage.getItem("currentBranchId") || "",
      },
    });
    return res.blob();
  }
}

export const billService = new BillService();
