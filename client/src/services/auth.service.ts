import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse, User, AuthTokens, BranchInfo } from "../types";

class AuthService extends ApiService {
  constructor() {
    super("/api/auth");
  }

  async login(username: string, password: string): Promise<ApiResponse<AuthTokens>> {
    return api.post<AuthTokens>(`${this.basePath}/login`, { username, password });
  }

  async register(data: { username: string; password: string; role?: string }): Promise<ApiResponse<AuthTokens>> {
    return api.post<AuthTokens>(`${this.basePath}/register`, data);
  }

  async me(): Promise<ApiResponse<User>> {
    return api.get<User>(`${this.basePath}/me`);
  }

  async refresh(refreshToken: string): Promise<ApiResponse<{ access: string }>> {
    return api.post<{ access: string }>(`${this.basePath}/refresh`, { refresh: refreshToken });
  }

  async getBranches(): Promise<ApiResponse<BranchInfo[]>> {
    return api.get<BranchInfo[]>(`${this.basePath}/branches`);
  }
}

export const authService = new AuthService();
