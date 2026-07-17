import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse } from "../types";

class WhatsAppService extends ApiService {
  constructor() {
    super("/api/whatsapp");
  }

  async sendMessage(data: { to: string; message: string; template?: string }): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.basePath}/send`, data);
  }

  async sendBill(data: { customerId: string; billId: string }): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.basePath}/send-bill`, data);
  }

  async sendReminder(data: { customerId: string; message: string }): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.basePath}/send-reminder`, data);
  }
}

export const whatsappService = new WhatsAppService();
