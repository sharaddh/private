import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse } from "../types";

export interface WhatsAppStatus {
  status: "connected" | "error" | "disconnected";
  error?: string;
  connectedPhone?: string | null;
  queueLength?: number;
}

export interface WhatsAppSendResult {
  success: boolean;
  sent?: boolean;
  queued?: boolean;
  message?: string;
  messageId?: string;
}

export interface WhatsAppBroadcastResult {
  sent: number;
  failed: number;
  results: { phone: string; status: "sent" | "failed" }[];
}

class WhatsAppService extends ApiService {
  constructor() {
    super("/api/whatsapp");
  }

  async sendMessage(data: { phone: string; message: string; template?: string }): Promise<ApiResponse<WhatsAppSendResult>> {
    return api.post<WhatsAppSendResult>(`${this.basePath}/send`, data);
  }

  async sendMedia(data: { phone: string; base64: string; filename: string; caption?: string; mimetype?: string }): Promise<ApiResponse<WhatsAppSendResult>> {
    return api.post<WhatsAppSendResult>(`${this.basePath}/send-media`, data);
  }

  async getStatus(): Promise<ApiResponse<WhatsAppStatus>> {
    return api.get<WhatsAppStatus>(`${this.basePath}/status`);
  }

  async broadcast(data: { numbers: string[]; message?: string; antiban?: { delayMin?: number; delayMax?: number; batchSize?: number; pause?: number }; media?: { base64: string; filename: string; mimetype: string } }): Promise<ApiResponse<WhatsAppBroadcastResult>> {
    return api.post<WhatsAppBroadcastResult>(`${this.basePath}/broadcast`, data);
  }

  async abortBroadcast(): Promise<ApiResponse<null>> {
    return api.post<null>(`${this.basePath}/broadcast/abort`, {});
  }
}

export const whatsappService = new WhatsAppService();
