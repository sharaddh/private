import { getWhatsAppConfig, isMetaConfigured } from "./config";
import {
  WhatsAppProviderError,
  type PhoneNumberHealth,
  type ProviderAcceptedMessage,
  type SendDocumentTemplateInput,
  type SendTemplateInput,
  type TemplateHeaderParameter,
  type WhatsAppProvider,
} from "./provider";

interface MetaErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
}

function graphUrl(path: string): string {
  const cfg = getWhatsAppConfig();
  return `https://graph.facebook.com/${cfg.graphApiVersion}/${path.replace(/^\/+/, "")}`;
}

function classifyMetaError(
  status: number,
  code: number | undefined,
  message: string
): {
  classification: WhatsAppProviderError["classification"];
  retryable: boolean;
  safeToRetry: boolean;
} {
  if (status === 429 || code === 130429 || code === 131056) {
    return { classification: "rate_limited", retryable: true, safeToRetry: true };
  }
  if (status >= 500) {
    return { classification: "provider_5xx", retryable: true, safeToRetry: true };
  }
  if (code === 190 || code === 102 || code === 200) {
    return { classification: "invalid_credentials", retryable: false, safeToRetry: false };
  }
  if (code === 131031 || code === 131048 || code === 131049 || code === 131050) {
    return { classification: "account_restricted", retryable: false, safeToRetry: false };
  }
  if (code === 131026 || code === 131027 || code === 131028) {
    return { classification: "recipient_ineligible", retryable: false, safeToRetry: false };
  }
  if (code === 132000 || code === 132001 || code === 132005 || code === 132007 || code === 132012) {
    return { classification: "template_unavailable", retryable: false, safeToRetry: false };
  }
  if (code === 132015 || code === 132016) {
    return { classification: "template_unavailable", retryable: false, safeToRetry: false };
  }
  if (code === 131053 || code === 131052) {
    return { classification: "media_upload_failed", retryable: false, safeToRetry: false };
  }
  if (code === 131009 || code === 131008 || /phone|recipient/i.test(message)) {
    return { classification: "invalid_phone", retryable: false, safeToRetry: false };
  }
  return { classification: "unknown", retryable: false, safeToRetry: false };
}

function componentsFor(input: SendTemplateInput) {
  const components: Record<string, unknown>[] = [];
  const header = input.header;
  if (header) {
    if (header.type === "document" && header.mediaId) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "document",
            document: { id: header.mediaId, filename: header.filename || "document.pdf" },
          },
        ],
      });
    } else if (header.type === "text" && header.text !== undefined) {
      components.push({
        type: "header",
        parameters: [{ type: "text", text: header.text }],
      });
    }
  }
  if (input.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
    });
  }
  return components;
}

export class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  readonly mode = "meta" as const;

  isConfigured(): boolean {
    return isMetaConfigured();
  }

  private async request(path: string, init: RequestInit, timeoutMs = 20000): Promise<any> {
    const cfg = getWhatsAppConfig();
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      throw new WhatsAppProviderError("Meta WhatsApp is not configured", "configuration");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(graphUrl(path), {
        ...init,
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      throw new WhatsAppProviderError(
        err instanceof Error && err.name === "AbortError"
          ? "Meta request timed out"
          : "Meta network request failed",
        "transient_network",
        { retryable: false, safeToRetry: false }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 200) };
    }

    if (!response.ok) {
      const metaError = (payload as MetaErrorPayload).error;
      const message =
        metaError?.error_data?.details ||
        metaError?.message ||
        `Meta request failed with HTTP ${response.status}`;
      const classified = classifyMetaError(response.status, metaError?.code, message);
      throw new WhatsAppProviderError(message.slice(0, 300), classified.classification, {
        statusCode: response.status,
        providerCode: metaError?.code ? String(metaError.code) : undefined,
        retryable: classified.retryable,
        safeToRetry: classified.safeToRetry,
      });
    }

    return payload;
  }

  private async uploadMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const cfg = getWhatsAppConfig();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
    const payload = await this.request(`${cfg.phoneNumberId}/media`, {
      method: "POST",
      body: form,
    });
    if (!payload?.id) {
      throw new WhatsAppProviderError("Meta did not return a media id", "media_upload_failed", {
        safeToRetry: false,
      });
    }
    return String(payload.id);
  }

  private async sendPrepared(
    input: SendTemplateInput,
    headerOverride?: TemplateHeaderParameter
  ): Promise<ProviderAcceptedMessage> {
    const cfg = getWhatsAppConfig();
    const header = headerOverride || input.header;
    const payload = await this.request(`${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode },
          components: componentsFor({ ...input, header }),
        },
      }),
    });

    const providerMessageId = payload?.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new WhatsAppProviderError(
        "Meta accepted the request but did not return a message id",
        "unknown",
        { safeToRetry: false }
      );
    }

    return {
      providerMessageId: String(providerMessageId),
      acceptedAt: new Date(),
      providerStatus: "accepted",
    };
  }

  async sendTemplate(input: SendTemplateInput): Promise<ProviderAcceptedMessage> {
    return this.sendPrepared(input);
  }

  async sendDocumentTemplate(input: SendDocumentTemplateInput): Promise<ProviderAcceptedMessage> {
    let mediaId: string;
    try {
      mediaId = await this.uploadMedia(
        input.document.buffer,
        input.document.filename,
        input.document.mimeType
      );
    } catch (err) {
      if (err instanceof WhatsAppProviderError) throw err;
      throw new WhatsAppProviderError("Media upload failed", "media_upload_failed");
    }

    return this.sendPrepared(input, {
      type: "document",
      mediaId,
      filename: input.document.filename,
    });
  }

  async getPhoneNumberHealth(): Promise<PhoneNumberHealth> {
    const cfg = getWhatsAppConfig();
    const payload = await this.request(
      `${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`,
      { method: "GET" }
    );
    return {
      displayPhoneNumber: payload?.display_phone_number,
      verifiedName: payload?.verified_name,
      qualityRating: payload?.quality_rating,
      status: payload?.status,
    };
  }
}
