# WhatsApp Operations Runbook

## Processes

| Process | Command | Role |
| --- | --- | --- |
| API | `npm run dev` (local) / `npm start` (prod) | Serves UI/API and optionally the inline worker. |
| Worker (dev) | `npm run worker:whatsapp` | Polls outbox, campaigns, reminders, webhooks, retention. |
| Worker (prod) | `npm run worker:whatsapp:prod` | Same, from compiled output. |
| Migrations | `npm run migrate:prod` | Applies Prisma migrations with the unpooled URL. |

Run exactly one worker mode per environment: either inline **or** standalone. Multiple
standalone workers are safe because claims use compare-and-set locks, but keep the
initial deployment to one worker and low concurrency.

## First-time enablement sequence

1. Apply migrations and start the API with `WHATSAPP_PROVIDER=mock`; confirm the
   Communications UI loads and status is healthy.
2. Complete `META_SETUP_HANDOFF.md`, including webhook verification and approved
   templates.
3. Switch `WHATSAPP_PROVIDER=meta`; leave both send gates `false`.
4. Start the standalone worker and confirm the log line `WhatsApp worker started`.
5. Verify `GET /api/communications/status`: `providerConfigured` is true and
   `webhook.appSecretSet` / `verifyTokenSet` are true.
6. Enable branch sending, then the global `WHATSAPP_SEND_ENABLED`, and send a
   controlled test to an internal number.
7. Verify the message log reaches `sent`/`delivered` and the webhook is receiving
   events. Enable campaigns only after this succeeds.

## Daily checks

- Status page: queue pending/failed, today submitted/delivered/failed, last queue error.
- Worker logs: tick failures, retention failures, window state transitions.
- Meta Business Manager: quality rating, messaging limits, template status changes.
- Delivery log: filter `failed` and `submission_unknown`; investigate recurring
  error codes rather than retrying blindly.

## Failure handling

| Symptom | Meaning | Action |
| --- | --- | --- |
| `live_sending_disabled` | Global gate closed | Enable it only when intentionally going live. |
| `provider_not_configured` | Missing Meta env values | Fill the five Meta variables and restart. |
| `branch_sending_disabled` / kill switch | Branch gate closed | Open in branch settings after review. |
| `template_unavailable` | No approved template mapping | Approve in Meta, map the template with the same name/language. |
| `recipient_ineligible` | Opt-out, missing consent, or invalid phone | Correct consent/phone; do not bypass. |
| `submission_unknown` | Provider acceptance not confirmed | Inspect Meta message logs; do not auto-retry. Resend only after confirming no duplicate. |
| Repeated `retryable` failures | Rate limit or transient provider issue | Let backoff work; lower concurrency if persistent. |
| Webhook not updating statuses | Bad URL, secret, or verify token | Recheck callback URL, app secret, and subscription fields. |
| Stalled `processing` rows | Worker crashed mid-send | Stale locks recover after five minutes; inspect logs for duplicates. |

## Campaign operations

- Preview before every start; review matched vs. eligible vs. skipped counts.
- Campaign sends are marketing-only and require explicit marketing consent.
- Pause is immediate for pending recipients; cancel stops the remaining queue.
- Retry is for failed recipients; it does not resend delivered messages.
- Clone creates a draft copy for recurring promotions.
- Keep an eye on Meta messaging limits after each large campaign.

## Retention

- Default retention: 180 days per branch, configurable from 1 to 3650 days.
- The worker sweeps once every 24 hours and deletes terminal rows older than the
  branch cutoff: messages, outbox rows, webhook events, and reminders.
- Consent audit rows are retained for compliance and are not deleted by the sweep.

## Webhook operations

- Callback URL: `https://<domain>/api/webhooks/whatsapp`.
- Verify token must match `META_WEBHOOK_VERIFY_TOKEN`.
- Subscribe to the `messages` field.
- The POST body must remain raw for HMAC verification; the route already uses a raw
  body parser before JSON middleware.
- Rejected signatures return 401 and are visible in API logs.

## Incident rollback

1. Enable the branch kill switch to stop new sends.
2. Set `WHATSAPP_SEND_ENABLED=false` for a global stop.
3. Leave the worker running so webhooks, retries, and retention continue safely.
4. Investigate logs and Meta Business Manager.
5. Re-enable branch sending first, then the global gate, and send one test message.
