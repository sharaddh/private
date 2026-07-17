import api from "../api";
import { ApiService, buildQueryString } from "./base";
import type { ApiResponse, Todo, PaginationParams } from "../types";

class TodoService extends ApiService {
  constructor() {
    super("/api/todos");
  }

  async listAll(params?: PaginationParams): Promise<ApiResponse<Todo[]>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<Todo[]>(`${this.basePath}${qs}`);
  }

  async toggle(id: string): Promise<ApiResponse<Todo>> {
    return api.patch<Todo>(`${this.basePath}/${id}/toggle`, {});
  }
}

export const todoService = new TodoService();
