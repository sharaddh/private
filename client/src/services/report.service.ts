import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, ReportData, DateRangeParams } from "../types";

class ReportService extends ApiService {
  constructor() {
    super("/api/reports");
  }

  async getSales(params?: DateRangeParams): Promise<ApiResponse<ReportData>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<ReportData>(`${this.basePath}/sales${qs}`);
  }

  async exportCsv(params?: DateRangeParams): Promise<Blob> {
    const qs = params ? buildQueryString(params) : "";
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}${this.basePath}/export${qs}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        "x-branch-id": localStorage.getItem("currentBranchId") || "",
      },
    });
    return res.blob();
  }
}

export const reportService = new ReportService();
