export type WhatsAppProvider = "meta";

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  verifyToken: string;
  appSecret: string;
}

export interface MetaSendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaSendError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

export interface WhatsAppMessageOptions {
  phone: string;
  message?: string;
  base64?: string;
  filename?: string;
  mimetype?: string;
  caption?: string;
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
  results: { phone: string; status: "sent" | "failed"; error?: string }[];
}

export interface WhatsAppStatusResponse {
  status: "connected" | "error" | "disconnected";
  error?: string;
  connectedPhone?: string | null;
  queueLength?: number;
}

export interface WebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{ wa_id: string; profile: { name: string } }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; filename: string; caption?: string };
        status?: "sent" | "delivered" | "read" | "played";
      }>;
      statuses?: Array<{
        id: string;
        status: "sent" | "delivered" | "read" | "played";
        timestamp: string;
        recipient_id: string;
        errors?: Array<{ code: number; title: string; message: string; error_data?: { details: string } }>;
      }>;
    };
    field: string;
  }>;
}

export interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

export interface MessageDoc {
  _id?: string;
  branchId: string;
  phone: string;
  direction: "outbound" | "inbound";
  type: "text" | "document" | "image" | "template";
  content: string;
  filename?: string;
  mimetype?: string;
  metaMessageId?: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BroadcastJob {
  _id?: string;
  branchId: string;
  numbers: string[];
  sent: number;
  failed: number;
  status: "running" | "completed" | "aborted";
  results: { phone: string; status: "sent" | "failed"; error?: string }[];
  createdAt: Date;
  updatedAt: Date;
}
