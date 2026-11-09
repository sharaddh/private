import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  flattenWebhookPayload,
  payloadFingerprint,
  verifyMetaSignature,
  verifyWebhookChallenge,
} from "./webhook";

const originalAppSecret = process.env.META_APP_SECRET;
const originalVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

beforeEach(() => {
  process.env.META_APP_SECRET = "test-app-secret";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
});

afterEach(() => {
  if (originalAppSecret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = originalAppSecret;
  if (originalVerifyToken === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  else process.env.META_WEBHOOK_VERIFY_TOKEN = originalVerifyToken;
});

function sign(body: string, secret = "test-app-secret"): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  it("accepts a valid signature", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    expect(verifyMetaSignature(body, sign(body.toString()))).toBe(true);
  });

  it("rejects a wrong or missing signature", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    expect(verifyMetaSignature(body, sign(body.toString(), "wrong-secret"))).toBe(false);
    expect(verifyMetaSignature(body, "sha256=deadbeef")).toBe(false);
    expect(verifyMetaSignature(body, undefined)).toBe(false);
  });

  it("rejects everything when no app secret is configured", () => {
    delete process.env.META_APP_SECRET;
    const body = Buffer.from("{}");
    expect(verifyMetaSignature(body, sign(body.toString()))).toBe(false);
  });
});

describe("verifyWebhookChallenge", () => {
  it("returns the challenge for a valid subscription request", () => {
    expect(verifyWebhookChallenge("subscribe", "test-verify-token", "challenge-1")).toBe(
      "challenge-1"
    );
  });

  it("rejects wrong tokens, modes, or missing values", () => {
    expect(verifyWebhookChallenge("subscribe", "wrong", "challenge-1")).toBeNull();
    expect(verifyWebhookChallenge("unsubscribe", "test-verify-token", "challenge-1")).toBeNull();
    expect(verifyWebhookChallenge("subscribe", "test-verify-token", undefined)).toBeNull();
  });
});

describe("flattenWebhookPayload", () => {
  it("extracts delivery statuses and inbound opt-outs", () => {
    const items = flattenWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  {
                    id: "wamid.outbound",
                    status: "delivered",
                    timestamp: "1700000000",
                    recipient_id: "919876543210",
                  },
                ],
                messages: [
                  {
                    id: "wamid.inbound",
                    from: "919876543210",
                    type: "text",
                    timestamp: "1700000100",
                    text: { body: "STOP" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      dedupeKey: "status:wamid.outbound:delivered:1700000000",
      eventType: "message_status",
      payload: { providerMessageId: "wamid.outbound", status: "delivered" },
    });
    expect(items[0].payload.recipientMasked).toBe("+91******3210");
    expect(items[1]).toMatchObject({
      dedupeKey: "inbound:wamid.inbound",
      eventType: "inbound_message",
      payload: { providerMessageId: "wamid.inbound", optedOut: true },
    });
  });

  it("ignores unrelated objects and fields", () => {
    expect(flattenWebhookPayload({ object: "page", entry: [] })).toEqual([]);
    expect(
      flattenWebhookPayload({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "message_template_status_update", value: {} }] }],
      })
    ).toEqual([]);
  });
});

describe("payloadFingerprint", () => {
  it("is stable for the same bytes and changes with content", () => {
    const a = payloadFingerprint(Buffer.from("hello"));
    expect(a).toBe(payloadFingerprint(Buffer.from("hello")));
    expect(a).not.toBe(payloadFingerprint(Buffer.from("hello!")));
  });
});
