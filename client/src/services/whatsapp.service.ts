import api from "../api";
import { ApiService } from "./base";
import type { ApiResponse } from "../types";

export interface WhatsAppStatus {
  status: "connected" | "qr" | "pairing" | "initializing" | "disconnected" | "error";
  error?: string;
  qr?: string | null;
  pairingCode?: string;
  queueLength?: number;
  connectedPhone?: string | null;
}

export interface WhatsAppSendResult {
  success: boolean;
  sent?: boolean;
  queued?: boolean;
  message?: string;
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

  async getQR(): Promise<ApiResponse<{ qr: string | null; status: string }>> {
    return api.get<{ qr: string | null; status: string }>(`${this.basePath}/qr`);
  }

  async getQueue(): Promise<ApiResponse<{ queueLength: number }>> {
    return api.get<{ queueLength: number }>(`${this.basePath}/queue`);
  }

  async disconnect(): Promise<ApiResponse<null>> {
    return api.post<null>(`${this.basePath}/disconnect`, {});
  }

  async init(): Promise<ApiResponse<null>> {
    return api.post<null>(`${this.basePath}/init`, {});
  }

  async pair(data: { phone: string }): Promise<ApiResponse<{ pairingCode: string }>> {
    return api.post<{ pairingCode: string }>(`${this.basePath}/pair`, data);
  }

  async broadcast(data: { numbers: string[]; message?: string; antiban?: { delayMin?: number; delayMax?: number; batchSize?: number; pause?: number }; media?: { base64: string; filename: string; mimetype: string } }): Promise<ApiResponse<WhatsAppBroadcastResult>> {
    return api.post<WhatsAppBroadcastResult>(`${this.basePath}/broadcast`, data);
  }

  async abortBroadcast(): Promise<ApiResponse<null>> {
    return api.post<null>(`${this.basePath}/broadcast/abort`, {});
  }
}

export const whatsappService = new WhatsAppService();
