import { createHash } from "crypto";
import {
  type PhoneNumberHealth,
  type ProviderAcceptedMessage,
  type SendDocumentTemplateInput,
  type SendTemplateInput,
  type WhatsAppProvider,
} from "./provider";

export interface MockProviderCall {
  kind: "template" | "document";
  input: SendTemplateInput | SendDocumentTemplateInput;
  at: Date;
}

const calls: MockProviderCall[] = [];

function deterministicId(idempotencyKey: string): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24);
  return `mock_${digest}`;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly mode = "mock" as const;

  isConfigured(): boolean {
    return true;
  }

  async sendTemplate(input: SendTemplateInput): Promise<ProviderAcceptedMessage> {
    calls.push({ kind: "template", input, at: new Date() });
    return {
      providerMessageId: deterministicId(input.idempotencyKey),
      acceptedAt: new Date(),
      providerStatus: "accepted",
    };
  }

  async sendDocumentTemplate(input: SendDocumentTemplateInput): Promise<ProviderAcceptedMessage> {
    calls.push({ kind: "document", input, at: new Date() });
    return {
      providerMessageId: deterministicId(input.idempotencyKey),
      acceptedAt: new Date(),
      providerStatus: "accepted",
    };
  }

  async getPhoneNumberHealth(): Promise<PhoneNumberHealth> {
    return {
      displayPhoneNumber: "+91 00000 00000",
      verifiedName: "KMJ Optical (mock)",
      qualityRating: "GREEN",
      status: "CONNECTED",
    };
  }
}

export function getMockProviderCalls(): readonly MockProviderCall[] {
  return calls;
}

export function resetMockProvider(): void {
  calls.length = 0;
}
