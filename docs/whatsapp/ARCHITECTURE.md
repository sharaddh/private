# WhatsApp Communications Architecture

This module adds WhatsApp Cloud API messaging to the KMJ Optical ERP. It supports
transactional order/payment/invoice notifications and opt-in marketing campaigns.

## Goals

- Never send a message unless every safety gate is open.
- Keep WhatsApp failures from breaking order, billing, or payment writes.
- Make every send auditable, idempotent, and recoverable.
- Support local development without Meta credentials via a mock provider.

## Components

```
Order / Payment / Invoice / Campaign
              |
              v
     events.ts / campaign.ts
              |
              v
     WhatsAppOutbox (durable)
              |
              v
  worker (inline in API or standalone)
     |        |          |
     v        v          v
 provider   webhook   reminders
 (mock/meta) processor
     |          |
     v          v
WhatsAppMessage  WhatsAppWebhookEvent
              |
              v
      API + owner-only UI
```

| Layer | Location | Responsibility |
| --- | --- | --- |
| Event capture | `server/src/whatsapp/events.ts` | Map order/payment/invoice changes to outbox rows. |
| Outbox | `server/src/whatsapp/outbox.ts` | Claim, retry, and process due messages. |
| Provider | `server/src/whatsapp/meta.provider.ts`, `mock.provider.ts` | Send templates/documents and report health. |
| Webhook | `server/src/whatsapp/webhook.ts`, `controllers/whatsappWebhook.controller.ts` | Verify Meta signatures, store and process delivery/inbound events. |
| Consent | `server/src/whatsapp/consent.ts` | Normalize phones, derive status, enforce eligibility. |
| Campaigns | `server/src/whatsapp/campaign.ts` | Audience preview, recipient materialization, throttled sends. |
| Reminders | `server/src/whatsapp/reminders.ts` | Schedule and process balance-due reminders. |
| Worker | `server/src/whatsapp/worker.ts`, `worker-entry.ts` | Polling loop for campaigns, reminders, outbox, webhooks, retention. |
| API | `server/src/routes/communications.ts` | Owner-only configuration, templates, logs, consent, campaigns. |
| UI | `client/src/pages/Communications.tsx` | Communications workspace tabs and controls. |

## Data flow

1. A business write records an event with an event ID.
2. An outbox row is created with a unique `eventId`, event type, entity, customer,
   and branch. Duplicate event IDs are ignored.
3. The worker claims due rows using a compare-and-set update, so two workers cannot
   process the same row.
4. Before sending, the worker re-checks:
   - provider configuration,
   - global and branch send gates,
   - kill switch,
   - trigger enabled state,
   - approved template availability,
   - consent and phone validity.
5. The message row is created as `submitting`, then updated from the provider result.
6. Meta delivery events arrive at `/api/webhooks/whatsapp`, are deduplicated, and
   update message status.

## Safety and idempotency

- Live sending defaults to **off** (`WHATSAPP_SEND_ENABLED=false`).
- Campaign sending has an additional global and branch gate.
- The provider is `mock` by default; `meta` requires all five Meta credentials.
- Outbox rows use a unique event ID; message rows use `idempotencyKey = outbox:<eventId>`.
- If the provider outcome is unknown, the message becomes `submission_unknown` and is
  **not** retried automatically, avoiding duplicate customer messages.
- Retries use exponential backoff with jitter and a capped attempt count.
- Stale `processing` locks are recovered after five minutes.

## Status model

- Outbox: `pending`, `processing`, `completed`, `failed`.
- Message: `submitting`, `submitted`, `sent`, `delivered`, `read`, `retryable`,
  `failed`, `submission_unknown`, `skipped`, `received`.
- Delivery updates are applied from Meta status webhooks by provider message ID.

## Multi-branch and security

- Every row is scoped by `branchId`; API requests derive the branch from `x-branch-id`.
- Communications routes require an authenticated `owner`.
- The webhook route is public by design but requires a valid `X-Hub-Signature-256`
  HMAC when `META_APP_SECRET` is set.
- Phone numbers are masked in logs and API list responses.
- Secrets are read from environment variables and never returned by status endpoints.

## Deployment topology

- API process: serves the owner UI/API and can run the worker inline
  (`WHATSAPP_WORKER_INLINE=true`) for simple deployments.
- Standalone worker: `npm run worker:whatsapp` or `npm run worker:whatsapp:prod`.
  Recommended for production so API latency is unaffected.
- Optional worker window (`WHATSAPP_WORKER_WINDOW_*`) pauses polling at night,
  reducing idle database activity on Neon.
