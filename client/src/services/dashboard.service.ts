import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse, DashboardData } from "../types";

class DashboardService extends ApiService {
  constructor() {
    super("/api/dashboard");
  }

  async getData(): Promise<ApiResponse<DashboardData>> {
    return api.get<DashboardData>(`${this.basePath}/stats`);
  }
}

export const dashboardService = new DashboardService();
