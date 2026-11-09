# KMJ Optical ERP — WhatsApp Cloud API Automation & Campaign Engine
## Implementation specification for an AI coding agent

**Repository:** `https://github.com/sharaddh/private`  
**Project:** KMJ Optical ERP 2.0  
**Implementation boundary:** Implement and test the complete application-side integration. Do **not** attempt Meta Business verification, phone-number registration, template submission, production credential creation, or live bulk sending. Stop at a clean, documented Meta-configuration handoff.

---

# 0. Mission

Implement a production-minded WhatsApp communication module inside the existing KMJ Optical ERP.

The module must support two use cases through one provider integration:

1. **Transactional automation** — send WhatsApp notifications when ERP events occur:
   - Order created / confirmed
   - Order status changed (processing, ready, dispatched, out for delivery, delivered, cancelled)
   - Payment received
   - Partial payment received / balance remains
   - Payment reminder (scheduled and manually triggered)
   - Bill / invoice generated, with PDF document attachment where supported
   - Receipt generated
   - Other relevant events discovered in the existing ERP

2. **Admin-created campaigns** — occasional consent-based campaigns to eligible customers, such as:
   - Diwali / Holi / New Year greetings
   - Store announcements
   - New collection announcements
   - Promotional offers
   - Eye-checkup or service reminders

The ERP currently has approximately 10,000 customer records. Do not assume all records are valid WhatsApp recipients or have marketing consent. The system must audit, segment, and enforce consent before any send.

**Primary provider:** Official Meta WhatsApp Cloud API.  
**Do not use OpenWA, Baileys, whatsapp-web.js, browser automation, QR-session automation, unofficial endpoints, or scraping.**

The result should be a native ERP module, not a disconnected application.

---

# 1. Mandatory repository-first workflow

Before editing anything:

1. Inspect the actual repository and current branch.
2. Read root `README.md`, root `package.json`, `server/package.json`, `client/package.json`, `docker-compose.yml`, environment examples, deployment configuration, and relevant project documentation.
3. Inspect the complete existing backend architecture:
   - Express app bootstrap and route registration
   - Authentication and authorization middleware
   - Existing user roles / permissions
   - MongoDB connection and Mongoose conventions
   - Existing customer, order, payment, invoice/bill, receipt, branch, and audit models
   - Existing order/payment/billing services and controllers
   - Existing Redis setup and any queues/workers/schedulers
   - Existing file/PDF generation and storage services
   - Existing webhook routes
   - Existing notification or activity-log functionality
4. Inspect the frontend navigation, page/layout conventions, API client, form components, table components, modal/dialog components, toast/notification patterns, chart library (if any), and role guards.
5. Inspect the warehouse app only where its order/status events affect customer notifications.
6. Identify actual field names and event transitions from source code. Do not invent model fields or assume names from this specification.
7. Produce a short implementation plan based on the actual repository, then proceed with implementation. Do not stop after the plan.

**Critical:** The repository README is only a starting point and may be stale. The code is the source of truth. Preserve existing conventions and avoid duplicate infrastructure.

## Existing project shape described by the README

The README describes:
- `client/` — React + TypeScript + Vite
- `server/` — Node.js + Express + TypeScript + MongoDB
- `warehouse/` — separate warehouse app
- MongoDB and Redis in the architecture
- Existing WhatsApp webhook mention

Verify all of this in the checked-out source. Do not blindly follow this outline if the current code differs.

---

# 2. Non-negotiable engineering rules

1. **No breaking existing ERP workflows.** Existing order, payment, billing, inventory, warehouse, customer, and branch flows must continue working.
2. **No direct Meta API calls inside controllers.** Use a provider/service abstraction.
3. **No sending before commit.** A notification must not be sent for an ERP transaction that later fails or rolls back.
4. **Reliable event delivery.** Prefer a MongoDB transactional outbox if transactions are already supported and deployed correctly. Otherwise implement a durable outbox with safe state transitions and explain the consistency guarantees. Do not assume MongoDB transactions are available in every deployment topology.
5. **Idempotency.** Repeated event delivery, worker retries, webhook retries, or duplicate clicks must not create duplicate customer messages.
6. **Consent enforcement is server-side and mandatory.** Frontend filtering is not sufficient.
7. **Marketing and utility/transactional messages must be distinguished.** Never disguise marketing content as utility.
8. **Template-first sending.** Outside an eligible 24-hour customer-service window, use an approved Meta template. For business-initiated notifications and campaigns, implement template messages as the default. Free-form text is only allowed when Meta's current customer-service-window rules permit it.
9. **No invented delivery status.** API acceptance is not delivery. Use Meta webhook status events for sent/delivered/read/failed where provided.
10. **No secrets in source control, frontend bundles, logs, error responses, screenshots, or analytics.**
11. **No live sends in development/tests by default.** Use a mock provider unless an explicit, deliberate production configuration is supplied.
12. **No hard-coded rate, throughput, messaging limits, or pricing assumptions.** Use configurable throttling and current Meta account/API limits. The app should display configuration/status and handle Meta errors.
13. **No automatic sending to all 10,000 contacts merely because they exist in the database.**
14. **Do not send to invalid, duplicate, opted-out, blocked, or ineligible numbers.**
15. **Do not silently change or migrate customers' existing phone/WhatsApp accounts.**

---

# 3. Target architecture

Adapt names to repository conventions, but preserve these responsibilities:

```text
Existing ERP business actions
  ├── Order created / status changed
  ├── Payment received / balance due
  ├── Bill / invoice / receipt generated
  └── Admin campaign created
             |
             v
      Domain event / notification dispatcher
             |
             v
       Durable notification outbox (MongoDB)
             |
             v
       Queue publisher / scheduler
             |
             v
        Redis + existing queue library
             |
             v
       Dedicated notification worker
             |
             v
       Notification orchestration service
             |
             +---- Consent / suppression checks
             +---- Trigger configuration
             +---- Template mapping + variables
             +---- Phone normalization / validation
             +---- Idempotency / deduplication
             |
             v
       WhatsAppProvider interface
             |
             v
       Meta WhatsApp Cloud API
             |
             v
       Meta Webhook (verify signature)
             |
             v
       Message status + inbound event processor
             |
             v
       MongoDB message logs / campaign analytics
             |
             v
       Existing ERP frontend
```

Use the existing Redis and queue infrastructure if it exists and is healthy. If there is no queue library, select a maintained TypeScript-compatible queue library that fits the existing Redis setup (BullMQ is a reasonable option). Do not introduce a second Redis instance or duplicate queue stack.

Run the worker as a separate process from the HTTP API in production. Document local development and deployment commands. If the deployment platform cannot run a persistent worker, document that constraint and do not pretend a web request or serverless function is a reliable long-running worker.

---

# 4. Provider abstraction

Create a provider interface, adapted to project style, with operations equivalent to:

```ts
interface WhatsAppProvider {
  sendTemplate(input: SendTemplateInput): Promise<ProviderAcceptedMessage>;
  sendDocumentTemplate(input: SendDocumentTemplateInput): Promise<ProviderAcceptedMessage>;
  getPhoneNumberHealth?(): Promise<PhoneNumberHealth>;
  // Add only capabilities genuinely needed by this ERP.
}
```

Implement:
- `MetaWhatsAppCloudProvider` — real Graph API integration, disabled until credentials are configured.
- `MockWhatsAppProvider` — deterministic local/test provider; never calls Meta.

Provider configuration must be selected server-side from validated environment/config. The frontend must never choose arbitrary provider URLs or submit tokens.

Use the currently supported Graph API version through configuration, e.g. `META_GRAPH_API_VERSION`. Do not hard-code a stale version throughout the codebase.

## Environment variables

Add these to the server's example environment file (not real values):

```env
WHATSAPP_PROVIDER=mock
META_GRAPH_API_VERSION=
META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_PUBLIC_URL=
WHATSAPP_DEFAULT_COUNTRY_CODE=91
WHATSAPP_SEND_ENABLED=false
WHATSAPP_CAMPAIGN_SEND_ENABLED=false
WHATSAPP_MAX_WORKER_CONCURRENCY=1
WHATSAPP_QUEUE_NAME=whatsapp-notifications
```

Use the repository's actual env naming and validation pattern. Do not print secrets in startup logs. Validate production configuration at startup, but allow the app to boot in mock mode without Meta credentials.

Do not create or commit `.env` with secrets. Update `.env.example` or equivalent only.

---

# 5. Customer phone and consent audit

The ERP has approximately 10,000 customers. Before campaigns, build a customer communication audit.

Inspect the current customer schema and avoid creating duplicate phone fields if an appropriate one exists. Add a backward-compatible migration/schema extension where necessary.

Store structured WhatsApp preferences, conceptually:

```ts
type WhatsAppConsentStatus =
  | "unknown"
  | "opted_in"
  | "opted_out";

interface CustomerWhatsAppPreferences {
  phoneE164?: string;
  phoneCountry?: string;
  phoneValidationStatus?: "valid" | "invalid" | "unknown";
  consentStatus: WhatsAppConsentStatus;
  consentCategories: {
    transactional: boolean;
    marketing: boolean;
  };
  consentSource?: string;
  consentCapturedAt?: Date;
  consentEvidence?: string;
  optedOutAt?: Date;
  lastConsentUpdatedAt?: Date;
}
```

Adapt this to actual customer model conventions. Do not assume that a phone number in the customer database proves WhatsApp consent.

Requirements:
- Normalize numbers to E.164 using a maintained phone-number library where appropriate.
- Default country code can be India (+91), but support explicit country codes and avoid blindly prefixing already international numbers.
- Preserve the original customer phone field and raw value.
- Detect invalid and duplicate normalized numbers.
- Do not merge customer records automatically.
- Unknown consent must be treated as **not eligible for marketing**.
- Transactional messages also require a valid lawful/business basis and appropriate customer expectations; do not assume every stored phone is eligible.
- Store consent source, timestamp, and evidence when captured.
- Add opt-out handling and suppression checks.
- If a customer opts out, suppress future marketing messages immediately.
- Provide a customer-level communication preference view/edit flow with audit history.
- If a customer replies with an opt-out keyword (e.g. STOP), process it safely and record opt-out. Support configurable recognized keywords and languages; do not rely only on exact English `STOP`.
- Do not claim that a campaign can reach all 10,000 customers. Display eligible count after filtering.

Create an admin-only **Customer WhatsApp Audit** view/report:
- Total customers
- Has phone
- Valid normalized phone
- Invalid / missing phone
- Duplicate normalized phone groups
- Marketing opted-in
- Transactional opted-in (if tracked)
- Unknown consent
- Opted out
- Eligible count by category

Allow export of audit results only if consistent with existing data-export security policies. Do not expose full phone numbers unnecessarily; mask them in tables.

Do not bulk-mark existing customers as opted in. Do not infer consent from purchase history, previous contact, or possession of a phone number.

---

# 6. Notification event catalogue and trigger configuration

Implement a central event catalogue. Use real event names and actual ERP lifecycle transitions discovered in source code.

Suggested events:

## Orders
- `ORDER_CREATED`
- `ORDER_CONFIRMED`
- `ORDER_PROCESSING`
- `ORDER_READY`
- `ORDER_DISPATCHED`
- `ORDER_OUT_FOR_DELIVERY`
- `ORDER_DELIVERED`
- `ORDER_CANCELLED`

## Payments
- `PAYMENT_RECEIVED`
- `PAYMENT_PARTIALLY_RECEIVED`
- `PAYMENT_BALANCE_DUE`
- `PAYMENT_REFUND_PROCESSED` (only if refunds exist)

## Billing
- `INVOICE_GENERATED`
- `INVOICE_UPDATED` (only if meaningful and not noisy)
- `RECEIPT_GENERATED`

## Customer engagement
- `BIRTHDAY_GREETING`
- `SERVICE_REMINDER`
- `MARKETING_CAMPAIGN`

Do not create fake integrations for modules/events that do not exist. Mark unsupported events in the implementation report.

Create admin-configurable trigger settings:
- Enabled / disabled
- Event key
- Category (utility / marketing; actual Meta category remains subject to Meta classification)
- Approved template name and language
- Variable mapping
- Optional branch scope
- Optional conditions
- Created/updated by and timestamps

Defaults:
- All triggers disabled until Meta setup and templates are configured.
- Marketing automation disabled by default.
- No trigger can bypass consent or suppression checks.
- Avoid duplicate notifications for repeated status updates. Only notify on a real transition and only once per event/entity/version.

---

# 7. Message templates

Create a template registry in the ERP that maps internal event keys to Meta template names/languages and variable mappings.

Important:
- Meta template creation and approval happens in Meta WhatsApp Manager / platform. This application must not pretend it can approve templates.
- Provide a clear admin UI for mapping a local trigger to an already-approved Meta template.
- Store Meta template name, language code, expected components/parameters, category, status last synced/confirmed by admin, and optional notes.
- Do not assume a template is approved just because it is saved locally.
- Validate variable count/order/type before queueing.
- Store template variables as structured values, not by concatenating raw user-provided template strings.
- Escape/validate dynamic values and ensure missing customer/order fields do not produce malformed requests.
- Keep template content/category aligned with the actual approved Meta template.

Suggested template drafts to document for later creation in Meta:

| Internal event | Suggested template name | Likely category to submit for Meta review |
|---|---|---|
| Order confirmation | `kmj_order_confirmation` | Utility |
| Order ready | `kmj_order_ready` | Utility |
| Order dispatched | `kmj_order_dispatched` | Utility |
| Order delivered | `kmj_order_delivered` | Utility |
| Payment received | `kmj_payment_received` | Utility |
| Payment reminder | `kmj_payment_reminder` | Utility, subject to Meta classification |
| Invoice PDF | `kmj_invoice_document` | Utility |
| Receipt PDF | `kmj_receipt_document` | Utility |
| Birthday greeting | `kmj_birthday_greeting` | Marketing |
| Festival greeting | `kmj_festival_greeting` | Marketing |
| Promotional offer | `kmj_promotional_offer` | Marketing |

These are suggestions only. Meta determines template approval and can reclassify templates. Do not represent this table as guaranteed approval.

Add a template mapping screen with:
- Internal event
- Meta template name
- Language
- Category
- Header/body/button variable mapping
- Local status: unconfigured / configured / awaiting external approval confirmation / approved-confirmed / rejected
- Test-render preview (no live send)
- Admin notes

Do not let a user send a template whose status is not confirmed approved.

---

# 8. Transactional notification integration

Integrate at the correct business-service layer, not scattered controller code.

For each event:
1. Complete the ERP business operation.
2. Persist the outbox event reliably.
3. Publish/queue after durable persistence.
4. Worker loads current relevant data.
5. Check trigger config, consent, suppression, template readiness, branch rules, and recipient validity.
6. Build template parameters.
7. Submit via provider.
8. Save provider message ID and submission result.
9. Await webhook status updates.

Suggested payload shape:

```ts
interface NotificationOutboxEvent {
  eventId: string;
  eventType: string;
  entityType: "order" | "payment" | "invoice" | "receipt" | "customer";
  entityId: string;
  customerId: string;
  branchId?: string;
  eventVersion?: string;
  occurredAt: Date;
  payloadVersion: number;
  status: "pending" | "processing" | "queued" | "completed" | "failed";
  attempts: number;
}
```

The worker should generally fetch the latest authoritative order/payment/invoice/customer data by ID rather than trusting arbitrary client-supplied amounts or names in the event payload.

## Required safeguards
- Do not send `ORDER_READY` if the order was already ready and no real transition occurred.
- Do not send payment reminder if balance is zero, invoice is cancelled, or the customer has already paid.
- Re-check balance and payment status immediately before sending a scheduled reminder.
- Cancel or skip future reminders after payment/settlement.
- Do not send an invoice attachment before the PDF is successfully generated and stored.
- Use the ERP's existing invoice/PDF generation and secure file storage where possible.
- Avoid public permanent invoice URLs. Use an appropriate Meta media upload/document workflow or a secure, short-lived URL only where the chosen API flow supports it.
- Do not expose private invoice documents through public storage.
- Respect branch and customer associations.

---

# 9. Bulk campaign manager

Build a complete campaign workflow for occasional campaigns to a subset of eligible customers, potentially from a 10,000-record database.

## Campaign creation
Fields:
- Campaign name
- Internal description
- Campaign purpose/category (marketing or utility only where justified)
- Approved Meta template
- Language
- Template variable mapping
- Audience definition / saved segment
- Optional branch filter
- Optional customer filters
- Schedule: send now or future date/time
- Time zone (default `Asia/Kolkata`, but persist explicit timezone)
- Optional campaign expiry/cutoff
- Admin creator
- Confirmation preview

Do not provide an arbitrary free-form bulk text box that bypasses Meta templates. Campaigns must use approved marketing templates for marketing sends.

## Audience segmentation
Support filters based on actual existing fields, for example:
- All customers with valid phone and explicit marketing opt-in
- Branch
- Customer creation date
- Last purchase date
- Product/category purchased, only if reliably represented
- Customer type/tag, if present
- Birthday month, if date of birth exists and is appropriate to use
- Inactive customers, with a clear definition

Build a preview count before campaign creation. The backend must recompute eligibility at execution time, not trust a frontend count.

Unknown consent, opted-out, invalid, duplicate, or suppressed numbers must be excluded.

## Campaign lifecycle
Suggested states:
- `DRAFT`
- `SCHEDULED`
- `QUEUED`
- `PROCESSING`
- `PAUSED`
- `CANCEL_REQUESTED`
- `COMPLETED`
- `COMPLETED_WITH_ERRORS`
- `CANCELLED`
- `FAILED`

Support:
- Save draft
- Preview audience and rendered sample
- Schedule
- Start now
- Pause
- Resume
- Cancel remaining unsent recipients
- View campaign progress
- View recipient-level outcomes
- Retry eligible failures safely (never duplicate a message already accepted by Meta)
- Clone campaign as a new draft

A pause/cancel action must prevent new sends as soon as practical. Do not claim it can retract messages already accepted by Meta.

## Campaign recipient records
Create durable per-recipient records (or an equivalent design matching the existing database patterns):

```ts
interface CampaignRecipient {
  campaignId: string;
  customerId: string;
  normalizedPhone: string;
  status:
    | "pending"
    | "queued"
    | "submitted"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "skipped"
    | "opted_out";
  providerMessageId?: string;
  errorCode?: string;
  errorMessageSafe?: string;
  attempts: number;
  submittedAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  skipReason?: string;
  idempotencyKey: string;
}
```

Unique index should prevent duplicate recipient entries for the same campaign/customer. Add appropriate indexes for campaign, status, customer, provider message ID, and scheduled processing.

## Throughput and limits
- Use configurable worker concurrency and provider throttling.
- Start conservatively; do not assume the account can send 10,000 messages at once.
- Respect Meta rate limits, account messaging limits, quality signals, template status, and API errors.
- Use exponential backoff with jitter for transient network/5xx/rate-limit errors where retry is appropriate.
- Do not retry permanent recipient/template/permission errors blindly.
- Make retry idempotent.
- Show a warning if campaign audience exceeds current configured/known capacity.
- Do not hard-code a universal messages-per-second or daily limit. Limits can depend on the Meta account, number, region, quality, and current platform rules.

## Campaign analytics
Display counts separately:
- Audience matched
- Eligible after consent/validation/suppression
- Skipped with reasons
- Pending
- Queued
- Submitted / accepted by API
- Sent (only if confirmed by webhook)
- Delivered
- Read
- Failed
- Opted out

Clearly explain that API acceptance is not delivery. If Meta does not send a particular status, leave it unknown rather than inventing one.

---

# 10. Payment reminders and scheduled automation

Implement scheduled reminders only if the existing payment/invoice data supports them.

Requirements:
- Configurable reminder rules (e.g. due date, days after due date) with safe defaults disabled.
- Use a scheduler/queue supported by existing infrastructure.
- Persist scheduled reminder state in MongoDB/outbox.
- Re-check invoice outstanding balance, due date, cancellation/refund status, customer consent, and template approval immediately before sending.
- Cancel pending reminders when paid/settled.
- Deduplicate reminder by invoice + reminder rule + due-cycle.
- Avoid repeated daily reminders unless explicitly configured and approved.
- Provide an admin view of upcoming reminders and a way to disable them.

---

# 11. Invoice and receipt document delivery

Reuse the ERP's existing PDF generation logic.

Flow:
1. ERP creates invoice/receipt.
2. Generate PDF using existing service.
3. Verify PDF exists and is complete.
4. Upload media to Meta using the official media endpoint, or use the supported document flow.
5. Send approved document template with document header and correct filename/caption if template supports it.
6. Store Meta media ID and provider message ID (never store access token).
7. Handle failures and safe retry without duplicate sends.

Do not attach the wrong customer's document. Verify invoice/customer relationship before upload/send.

If the existing ERP has no reliable PDF generator, implement only the missing reusable service after inspecting current billing output; do not create a second inconsistent invoice format.

---

# 12. Meta webhook implementation

Implement application-side webhook endpoints, but do not configure them in Meta until the Meta handoff.

Required:
- `GET` webhook verification endpoint using configured verify token and Meta's challenge mechanism.
- `POST` webhook receiver.
- Validate `X-Hub-Signature-256` using HMAC SHA-256 with `META_APP_SECRET` against the **raw request body**.
- Use timing-safe comparison.
- Ensure raw body capture is correctly configured without breaking existing Express JSON parsing.
- Reject invalid signatures.
- Acknowledge valid webhook requests quickly; enqueue/process event payloads asynchronously.
- Deduplicate webhook events.
- Process message status updates by provider message ID.
- Handle sent/delivered/read/failed statuses and error details.
- Handle inbound messages and opt-out keywords where included.
- Store only necessary inbound content and follow the ERP's privacy/security policies.
- Do not log full message bodies or full phone numbers unnecessarily.
- Make webhook processing idempotent because Meta may retry webhook delivery.
- Validate payload structure; ignore unknown event types safely.
- Add tests for signature verification and invalid signatures.

Do not trust a query parameter alone to authenticate POST webhooks.

---

# 13. Frontend requirements

Add a WhatsApp/Communications area using existing UI patterns. Avoid redesigning the ERP shell.

Suggested navigation:
- Communications
  - Overview
  - Automation Rules
  - Campaigns
  - Templates
  - Message Logs
  - Customer Consent Audit
  - Settings

## Overview
- Provider mode: Mock / Meta
- Configuration status (configured / missing credentials / sending disabled)
- Worker/queue health if available
- Today's submitted/delivered/failed totals
- Recent campaigns
- Recent notification failures
- No secret values displayed

## Automation Rules
- List supported ERP events
- Enable/disable each trigger
- Select approved template mapping
- Show category and branch scope
- Show validation warnings
- Require confirmation for enabling live sending

## Campaigns
- Campaign list with status, created date, audience, eligible count, progress
- Create/edit draft
- Audience builder
- Audience preview and exclusions summary
- Template selector and rendered sample
- Schedule in Asia/Kolkata by default
- Confirm before scheduling/sending
- Pause/resume/cancel controls
- Recipient results with masked phone numbers
- Export only with appropriate permissions

## Templates
- Local template mapping registry
- Meta template name, language, category, parameter map
- Approval status confirmed by admin
- Render preview
- Do not claim to fetch Meta template approval state unless an actual supported API integration is implemented and configured.

## Message Logs
- Search by customer/order/invoice/provider message ID
- Filter by event/status/date/branch
- Show safe provider error details
- Show event timeline
- Mask phone number by default

## Customer consent
- Display current consent status and source/time
- Provide authorized way to record/update consent
- Provide opt-out action
- Audit every change
- Never bulk opt-in customers.

## UI safety
- Live sending disabled by default.
- Clear badge when in mock mode.
- Before first live send, show an explicit setup checklist and confirmation.
- Bulk campaign confirmation must show exact eligible recipient count, template, category, schedule, and branch/segment.
- Do not allow a campaign if eligible count is zero or template is not confirmed approved.

---

# 14. API design

Follow existing route/controller conventions and auth middleware. Suggested endpoints (adapt names and response format):

```text
GET    /api/communications/whatsapp/status
GET    /api/communications/whatsapp/audit
GET    /api/communications/whatsapp/triggers
PATCH  /api/communications/whatsapp/triggers/:id
GET    /api/communications/whatsapp/templates
POST   /api/communications/whatsapp/templates
PATCH  /api/communications/whatsapp/templates/:id

GET    /api/communications/whatsapp/campaigns
POST   /api/communications/whatsapp/campaigns
GET    /api/communications/whatsapp/campaigns/:id
POST   /api/communications/whatsapp/campaigns/:id/preview
POST   /api/communications/whatsapp/campaigns/:id/schedule
POST   /api/communications/whatsapp/campaigns/:id/start
POST   /api/communications/whatsapp/campaigns/:id/pause
POST   /api/communications/whatsapp/campaigns/:id/resume
POST   /api/communications/whatsapp/campaigns/:id/cancel
GET    /api/communications/whatsapp/campaigns/:id/recipients

GET    /api/communications/whatsapp/logs
GET    /api/communications/whatsapp/customers/:customerId/preferences
PATCH  /api/communications/whatsapp/customers/:customerId/preferences

GET    /api/webhooks/whatsapp
POST   /api/webhooks/whatsapp
```

Use actual existing API prefix conventions. Add request validation, pagination, sorting allowlists, authorization, and consistent error handling.

Potential permissions (map to existing role system):
- `whatsapp.view`
- `whatsapp.manage_settings`
- `whatsapp.manage_templates`
- `whatsapp.manage_triggers`
- `whatsapp.create_campaign`
- `whatsapp.send_campaign`
- `whatsapp.pause_campaign`
- `whatsapp.view_logs`
- `whatsapp.manage_consent`

Do not invent a parallel RBAC system if the ERP already has one. Ensure only authorized staff can create/send campaigns or alter consent.

---

# 15. Security, privacy, and compliance

- Keep Meta access token and app secret server-side only.
- Store secrets in deployment environment/secret manager.
- Never return secrets through any API.
- Never log Authorization headers or tokens.
- Validate and authorize all admin endpoints.
- Verify webhook signatures.
- Rate-limit campaign creation and manual sends.
- Add audit log entries for campaign creation, scheduling, start, pause, resume, cancellation, template mapping changes, trigger changes, and consent changes.
- Mask phone numbers in UI and logs by default.
- Restrict access to invoices and customer data by existing branch/role permissions.
- Do not upload customer lists to third-party services.
- Respect customer opt-outs and applicable privacy/marketing rules.
- Do not claim compliance solely because an opt-in boolean exists; retain consent source and timestamp.
- Add retention policy/configuration for message logs and inbound message content, consistent with business/legal requirements.
- Marketing content must use an approved marketing template and eligible opted-in audience.
- Operational notifications must accurately reflect the underlying ERP event and must not include promotional copy unless the template is categorized and approved appropriately.
- Add a global kill switch to disable all WhatsApp sends immediately.

---

# 16. Failure handling and reliability

Implement explicit error classification:

- Transient network failure
- Meta 5xx
- Rate limited / throttled
- Invalid access token / permissions
- Invalid phone number
- Template missing / rejected / not approved
- Recipient not eligible
- Business/account/number restriction
- Media upload failure
- Unknown provider error

Retry only transient errors and only with bounded exponential backoff plus jitter. Permanent errors should become terminal and visible to admins.

Use:
- Durable outbox
- Queue job IDs derived from stable idempotency keys
- Unique database indexes
- Per-recipient send state
- Worker lock/stalled-job recovery supported by the queue library
- Dead-letter/terminal failure visibility
- Manual retry only after checking current state
- Graceful shutdown of workers
- Health/readiness checks

Never mark a campaign completed just because queue jobs were enqueued. Completion should reflect recipient processing and final available status.

If a worker crashes after Meta accepted a message but before the provider message ID is persisted, avoid blindly retrying and duplicating. Design a conservative `SUBMISSION_UNKNOWN`/reconciliation state if needed; explain how it is resolved.

---

# 17. Testing requirements

All tests must use the mock provider. Tests must not contact Meta.

## Unit tests
- Phone normalization and invalid numbers
- Consent eligibility for transactional and marketing categories
- Opt-out suppression
- Template parameter mapping/validation
- Trigger enable/disable
- Event deduplication/idempotency
- Payment reminder balance recheck
- Retry classification/backoff
- Campaign audience filtering
- Campaign pause/cancel behavior
- Webhook signature verification
- Webhook duplicate handling
- Provider response mapping

## Integration tests
- Order transition writes an outbox event
- Payment event creates correct notification
- Invoice event sends document only after PDF exists
- Outbox publisher enqueues job
- Worker calls mock provider and persists provider result
- Meta status webhook updates the correct message
- Opt-out inbound event suppresses future marketing sends
- Campaign creates exactly one recipient record per eligible customer
- Duplicate job/webhook does not duplicate send
- Paid invoice causes scheduled reminder to skip/cancel

## Frontend tests
Use the project's existing testing stack:
- Admin permissions
- Empty/loading/error states
- Campaign preview and confirmation
- Consent display and update
- Trigger configuration
- Mock mode badge
- Live-send disabled state

## Build quality
Run:
- Backend typecheck/build
- Frontend typecheck/build
- Existing test suite
- New tests
- Lint/format commands available in the repo

Fix regressions introduced by this work. Do not hide failing tests or weaken existing checks.

---

# 18. Deployment and operations

- Add a separate worker start script using the existing TypeScript runtime/build system.
- Update Docker Compose only if the repository uses it and the deployment requires it.
- Reuse existing Redis service.
- Ensure API and worker share the same MongoDB/Redis configuration.
- Add health checks for API, worker, queue, and provider configuration without exposing secrets.
- Document process restart behavior and graceful shutdown.
- Document persistent queue storage and Redis persistence expectations.
- Document backups for MongoDB and operational recovery.
- Ensure the worker is deployed as a persistent process, not just a short-lived web request.
- Update deployment docs/configuration for the actual hosting platform after inspecting it. Do not assume Render/Railway/VPS behavior without checking current project deployment files.
- Do not enable live sending as part of deployment by default.

---

# 19. Meta setup handoff — STOP HERE

The coding agent must implement everything possible without access to the owner's Meta Business account.

At the end, produce a clear checklist for the owner to complete manually in Meta. Do not attempt to log into Meta, create a business, verify a business, register a real phone number, submit templates, or create production tokens.

Prepare the application to require these values:

- Meta Graph API version
- Meta access token (System User token suitable for the app's intended permissions)
- WhatsApp Phone Number ID
- WhatsApp Business Account ID
- Meta App Secret
- Webhook Verify Token (a strong random value generated by the owner)
- Public HTTPS webhook URL

The final handoff must explain:
1. Create/select Meta Business Portfolio.
2. Create/select Meta Developer App and add WhatsApp product.
3. Create/select WhatsApp Business Account.
4. Add and verify the business phone number; explain that an existing WhatsApp/WhatsApp Business app number may require migration or an eligible coexistence path. Do not promise that an existing number can be connected without impact.
5. Obtain Phone Number ID and WABA ID.
6. Configure the required app permissions and a suitable System User access token. Explain token expiry/management and secure storage; do not use temporary test token in production.
7. Configure webhook callback URL and verify token.
8. Subscribe to relevant WhatsApp webhook fields, including message status and inbound messages as required.
9. Submit templates for approval in the correct language/category.
10. Add the approved template names/languages and variable mappings in ERP.
11. Set server environment secrets in deployment.
12. Verify with a controlled test number and a test template before enabling production.
13. Enable live sending only after the owner explicitly confirms setup and consent/audience review.

Use official Meta documentation links in the handoff:
- WhatsApp Cloud API Get Started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- WhatsApp Cloud API Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- WhatsApp Business Platform documentation: https://developers.facebook.com/docs/whatsapp
- Meta Developers: https://developers.facebook.com/

Meta changes its interface, permissions, policies, pricing, and messaging limits. Verify current official documentation at implementation/handoff time; do not hard-code old limits or promise a particular free allowance.

---

# 20. Example template drafts to prepare (not submit)

Prepare a `docs/whatsapp/meta-template-drafts.md` file with draft copy and variable mappings for:

1. Order confirmation (utility)
2. Order ready (utility)
3. Order dispatched (utility)
4. Order delivered (utility)
5. Payment received (utility)
6. Payment reminder (utility, subject to Meta classification)
7. Invoice PDF (utility document template)
8. Receipt PDF (utility document template)
9. Festival greeting (marketing)
10. Promotional offer (marketing)
11. Birthday greeting (marketing)

Use clear, professional English drafts. If Hindi is useful for KMJ's customers, include a separate Hindi draft and language code only after checking Meta's current supported language-code requirements. Do not submit templates automatically.

Do not put marketing copy inside utility templates.

---

# 21. Required documentation deliverables

Create/update:

1. `docs/whatsapp/ARCHITECTURE.md`
2. `docs/whatsapp/IMPLEMENTATION.md`
3. `docs/whatsapp/ENVIRONMENT.md`
4. `docs/whatsapp/OPERATIONS.md`
5. `docs/whatsapp/META_SETUP_HANDOFF.md`
6. `docs/whatsapp/meta-template-drafts.md`
7. Relevant root/server README references
8. API documentation / OpenAPI definitions if the project maintains them

Document actual implementation decisions and limitations, not just this specification.

---

# 22. Definition of done

Do not declare completion until all applicable items are true:

- [ ] Existing ERP architecture and relevant business flows were inspected.
- [ ] Existing Redis/queue/storage/PDF/RBAC systems were reused where appropriate.
- [ ] Meta provider and mock provider are implemented behind an interface.
- [ ] App starts without Meta credentials in mock mode.
- [ ] Live sending is disabled by default.
- [ ] Customer phone/consent audit is implemented.
- [ ] Unknown consent is excluded from marketing campaigns.
- [ ] Opt-out suppression is implemented and tested.
- [ ] Trigger configuration is implemented.
- [ ] Order/payment/billing event integrations are implemented for events that actually exist.
- [ ] Durable outbox and idempotency are implemented.
- [ ] Background worker and scheduler are implemented.
- [ ] Bulk campaign creation, segmentation, preview, schedule, pause, resume, cancel, and analytics are implemented.
- [ ] Invoice/receipt document flow reuses existing PDF/storage functionality.
- [ ] Webhook verification and status processing are implemented.
- [ ] Admin frontend pages are implemented and permission-protected.
- [ ] Tests cover core workflows and failure paths.
- [ ] Backend/frontend builds and relevant tests pass.
- [ ] No secrets are committed or exposed.
- [ ] Deployment worker process is documented/configured.
- [ ] Meta handoff checklist is complete.
- [ ] No live Meta message was sent and no Meta account setup was attempted.

---

# 23. Final response required from the coding agent

When implementation is finished, report:

1. Repository areas inspected.
2. Architecture and key decisions.
3. Files created/modified.
4. Existing ERP events integrated and events not supported by current code.
5. Database schema changes and indexes.
6. New dependencies and why they were needed.
7. API endpoints added.
8. Frontend pages added.
9. Worker/queue run commands.
10. Tests/build commands and actual results.
11. Required environment variables (names only; never values).
12. Deployment changes.
13. Known limitations and unresolved issues.
14. Exact Meta Developer tasks the owner must now complete.
15. A safe first-live-send checklist.

**Work autonomously through the code implementation and tests. Do not stop to ask for Meta credentials. Stop only at the Meta setup handoff boundary described above.**
