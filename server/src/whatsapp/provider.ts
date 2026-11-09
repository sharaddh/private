export type ProviderErrorClass =
  | "transient_network"
  | "provider_5xx"
  | "rate_limited"
  | "invalid_credentials"
  | "invalid_phone"
  | "template_unavailable"
  | "recipient_ineligible"
  | "account_restricted"
  | "media_upload_failed"
  | "configuration"
  | "unknown";

export class WhatsAppProviderError extends Error {
  readonly classification: ProviderErrorClass;
  readonly retryable: boolean;
  readonly safeToRetry: boolean;
  readonly statusCode?: number;
  readonly providerCode?: string;
  readonly providerMessageId?: string;

  constructor(
    message: string,
    classification: ProviderErrorClass,
    options: {
      retryable?: boolean;
      safeToRetry?: boolean;
      statusCode?: number;
      providerCode?: string;
      providerMessageId?: string;
    } = {}
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
    this.classification = classification;
    this.retryable = options.retryable ?? false;
    this.safeToRetry = options.safeToRetry ?? this.retryable;
    this.statusCode = options.statusCode;
    this.providerCode = options.providerCode;
    this.providerMessageId = options.providerMessageId;
  }
}

export interface TemplateHeaderParameter {
  type: "document" | "text";
  text?: string;
  mediaId?: string;
  filename?: string;
}

export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters: string[];
  header?: TemplateHeaderParameter;
  idempotencyKey: string;
}

export interface SendDocumentTemplateInput extends SendTemplateInput {
  document: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
}

export interface ProviderAcceptedMessage {
  providerMessageId: string;
  acceptedAt: Date;
  providerStatus: string;
}

export interface PhoneNumberHealth {
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  status?: string;
}

export interface WhatsAppProvider {
  readonly mode: "mock" | "meta";
  isConfigured(): boolean;
  sendTemplate(input: SendTemplateInput): Promise<ProviderAcceptedMessage>;
  sendDocumentTemplate(input: SendDocumentTemplateInput): Promise<ProviderAcceptedMessage>;
  getPhoneNumberHealth?(): Promise<PhoneNumberHealth>;
}

export function toSafeErrorMessage(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value || "Unknown provider error");
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .slice(0, 300);
}
