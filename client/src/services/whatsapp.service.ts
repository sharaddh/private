import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse } from "../types";

class WhatsAppService extends ApiService {
  constructor() {
    super("/api/whatsapp");
  }

  async sendMessage(data: { phone: string; message: string; template?: string }): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.basePath}/send`, data);
  }
}

export const whatsappService = new WhatsAppService();
