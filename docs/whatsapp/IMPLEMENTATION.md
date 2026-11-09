# WhatsApp Implementation Notes

## Repository map

### Server

| File | Purpose |
| --- | --- |
| `src/whatsapp/types.ts` | Event definitions, categories, default template names, order status map. |
| `src/whatsapp/config.ts` | Environment parsing, worker window, configuration status. |
| `src/whatsapp/provider.ts` | Provider interface and safe error mapping. |
| `src/whatsapp/meta.provider.ts` | Meta Graph API sends, template upload/health calls. |
| `src/whatsapp/mock.provider.ts` | Local provider that accepts sends without Meta. |
| `src/whatsapp/provider-factory.ts` | Selects provider from configuration. |
| `src/whatsapp/phone.ts` | E.164 normalization, masking, opt-out keyword parsing. |
| `src/whatsapp/consent.ts` | Preference creation, consent updates, eligibility, audit. |
| `src/whatsapp/events.ts` | Business event to outbox capture. |
| `src/whatsapp/context.ts` | Builds template parameter values from order/payment/invoice data. |
| `src/whatsapp/templates.ts` | Approved template lookup, mapping resolution, preview rendering. |
| `src/whatsapp/outbox.ts` | Claiming, provider send, retry/backoff, idempotent replay. |
| `src/whatsapp/campaign.ts` | Audience filters, preview, materialization, send throttling. |
| `src/whatsapp/reminders.ts` | Reminder rules and due reminder processing. |
| `src/whatsapp/webhook.ts` | Signature verification and webhook event processing. |
| `src/whatsapp/settings.ts` | Per-branch gates, kill switch, retention, status payload. |
| `src/whatsapp/retention.ts` | Terminal-row retention sweeps. |
| `src/whatsapp/worker.ts` | Worker loop. |
| `src/whatsapp/worker-entry.ts` | Standalone worker process entry point. |
| `src/controllers/communications.controller.ts` | Communications REST handlers. |
| `src/controllers/whatsappWebhook.controller.ts` | Meta webhook GET/POST handlers. |
| `src/routes/communications.ts` | Owner-only API routes. |
| `src/routes/webhooks.ts` | Public webhook routes with raw body parsing. |
| `src/validators/communications.validator.ts` | Zod request schemas. |

### Client

| File | Purpose |
| --- | --- |
| `src/pages/Communications.tsx` | Tab shell, overview metrics, send/campaign/kill switch controls. |
| `src/components/communications/CommunicationsTemplates.tsx` | Template event mapping, status, parameter map. |
| `src/components/communications/CommunicationsAutomation.tsx` | Event triggers and reminder rules. |
| `src/components/communications/CommunicationsConsent.tsx` | Customer lookup, consent form, audit history. |
| `src/components/communications/CommunicationsCampaigns.tsx` | Create, preview, start, pause, resume, cancel, retry, clone. |
| `src/components/communications/CommunicationsLogs.tsx` | Log filters, status search, detail modal. |
| `src/services/communications.service.ts` | API client and TypeScript types. |

## API surface

All routes below are under `/api/communications`, require a JWT, and require the
`owner` role. The branch comes from the `x-branch-id` header.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/status` | Provider/config status, gates, today counts, queue, worker window. |
| GET | `/audit` | Recent consent audit records. |
| GET/PATCH | `/settings` | Branch send/campaign/kill switch/reminder/retention settings. |
| GET | `/triggers` | Event trigger configuration. |
| PATCH | `/triggers/:id` | Enable/disable or remap a trigger. |
| GET/POST | `/templates` | List/create local template mappings. |
| PATCH | `/templates/:id` | Update mapping, language, status, parameter map. |
| GET/POST | `/campaigns` | List/create campaigns. |
| GET/PATCH | `/campaigns/:id` | Campaign detail/update. |
| POST | `/campaigns/:id/preview` | Audience preview and skip counts. |
| POST | `/campaigns/:id/schedule` | Schedule a campaign. |
| POST | `/campaigns/:id/start\|pause\|resume\|cancel\|retry\|clone` | Campaign lifecycle. |
| GET | `/campaigns/:id/recipients` | Paginated recipient list. |
| GET | `/logs`, `/logs/:id` | Message log list/detail. |
| GET/PATCH | `/customers/:customerId/preferences` | Consent and phone preference. |
| GET/POST | `/reminder-rules` | List/create reminder rules. |
| PATCH/DELETE | `/reminder-rules/:id` | Update/delete reminder rule. |

Webhook endpoints (no JWT; Meta calls these):

- `GET /api/webhooks/whatsapp` — subscription challenge.
- `POST /api/webhooks/whatsapp` — signed event receiver.

## Event matrix

| Event | Entity | Category | Default template |
| --- | --- | --- | --- |
| `ORDER_CREATED` | order | utility | `kmj_order_confirmation` |
| `ORDER_CONFIRMED` | order | utility | `kmj_order_confirmation` |
| `ORDER_PROCESSING` | order | utility | `kmj_order_processing` |
| `ORDER_READY` | order | utility | `kmj_order_ready` |
| `ORDER_DELIVERED` | order | utility | `kmj_order_delivered` |
| `ORDER_CANCELLED` | order | utility | `kmj_order_cancelled` |
| `PAYMENT_RECEIVED` | payment | utility | `kmj_payment_received` |
| `PAYMENT_PARTIALLY_RECEIVED` | payment | utility | `kmj_payment_partial` |
| `PAYMENT_BALANCE_DUE` | invoice | utility | `kmj_payment_reminder` |
| `INVOICE_GENERATED` | invoice | utility | `kmj_invoice_document` |
| `MARKETING_CAMPAIGN` | customer | marketing | `kmj_promotional_offer` |

Order status mapping: `Ordered → ORDER_CONFIRMED`, `In Lab → ORDER_PROCESSING`,
`Ready → ORDER_READY`, `Delivered → ORDER_DELIVERED`, `Cancelled → ORDER_CANCELLED`.

## Consent semantics

- `opted_in`: at least one of transactional or marketing consent is true.
- `opted_out`: always stays out regardless of checkbox values; both consent flags are
  forced false and an audit record is written.
- `unknown`: no positive consent recorded.
- Transactional messages require `transactionalConsent`.
- Marketing messages require `consentStatus = opted_in` **and** `marketingConsent`.
- `opted_out` customers are never eligible for any category.
- Inbound opt-out keywords (for example `STOP`, `unsubscribe`, `band karo`, `रोको`)
  automatically mark the matching phone as opted out.
- Customers with invalid or missing phone numbers are skipped and reported in preview.

## Campaign behavior

- Audience filters: created date range, tags, city, spend range, pending balance,
  and inactive days.
- Preview reports matched, eligible, skipped, skip reasons, and masked samples.
- Starting a campaign materializes eligible recipients, then the worker sends in
  throttled batches.
- Campaign sends require the campaign-specific gate in addition to the normal gate.
- Pause/resume/cancel affect pending recipients only; already accepted sends are not
  recalled.
- Duplicate phone numbers within a branch are excluded from marketing audiences.

## Local verification

```powershell
cd D:\123\server
npm run typecheck
npm test -- --run

cd D:\123\client
npm run typecheck
npm run build
npm test -- --run
```

With `WHATSAPP_PROVIDER=mock` and a local worker, sends are recorded in the database
without calling Meta. Use the Communications UI to inspect logs, queue state, and
campaign results.
