import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse, Visit, Order, Bill } from "../types";

class WorkspaceService extends ApiService {
  constructor() {
    super("/api/workspace");
  }

  async getTodos(): Promise<ApiResponse<{ _id: string; task: string; done: boolean }[]>> {
    return api.get(`${this.basePath}/todos`);
  }

  async addTodo(task: string): Promise<ApiResponse<{ _id: string; task: string; done: boolean }>> {
    return api.post(`${this.basePath}/todos`, { task });
  }

  async toggleTodo(id: string): Promise<ApiResponse<{ _id: string; task: string; done: boolean }>> {
    return api.patch(`${this.basePath}/todos/${id}/toggle`, {});
  }

  async deleteTodo(id: string): Promise<ApiResponse<void>> {
    return api.del(`${this.basePath}/todos/${id}`);
  }

  async getQuickStats(): Promise<ApiResponse<{
    todayVisits: Visit[];
    pendingOrders: Order[];
    recentBills: Bill[];
  }>> {
    return api.get(`${this.basePath}/quick-stats`);
  }
}

export const workspaceService = new WorkspaceService();
