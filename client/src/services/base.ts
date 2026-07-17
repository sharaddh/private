import api, { type ApiResponse } from "../api";
import type { PaginationParams } from "../types";

// ─── Query String Builder ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildQueryString(params: Record<string, any>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ─── Base Service ────────────────────────────────────────────────────────────

export class ApiService {
  protected basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async list<T>(params?: PaginationParams): Promise<ApiResponse<T>> {
    const qs = params ? buildQueryString(params) : "";
    return api.get<T>(`${this.basePath}${qs}`);
  }

  async getById<T>(id: string): Promise<ApiResponse<T>> {
    return api.get<T>(`${this.basePath}/${id}`);
  }

  async create<T>(data: unknown): Promise<ApiResponse<T>> {
    return api.post<T>(this.basePath, data);
  }

  async update<T>(id: string, data: unknown): Promise<ApiResponse<T>> {
    return api.put<T>(`${this.basePath}/${id}`, data);
  }

  async patch<T>(id: string, data: unknown): Promise<ApiResponse<T>> {
    return api.patch<T>(`${this.basePath}/${id}`, data);
  }

  async remove<T>(id: string): Promise<ApiResponse<T>> {
    return api.del<T>(`${this.basePath}/${id}`);
  }
}
