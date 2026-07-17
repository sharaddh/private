import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse, ShopSettings } from "../types";

class SettingsService extends ApiService {
  constructor() {
    super("/api/settings");
  }

  async get(): Promise<ApiResponse<ShopSettings>> {
    return api.get<ShopSettings>(this.basePath);
  }

  async updateSettings(data: Partial<ShopSettings>): Promise<ApiResponse<ShopSettings>> {
    return api.put<ShopSettings>(this.basePath, data);
  }
}

export const settingsService = new SettingsService();
