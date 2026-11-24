# WhatsApp Environment Configuration

All values live in `server/.env` (or the hosting provider's environment). Start from
`server/.env.example`. Never commit real tokens or secrets.

## Core provider variables

| Variable                        | Default | Notes                                                                                              |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `WHATSAPP_PROVIDER`             | `mock`  | Use `mock` for local/test. Switch to `meta` only after Meta setup is complete.                     |
| `META_GRAPH_API_VERSION`        | `v23.0` | Graph API version used by all Meta calls.                                                          |
| `META_ACCESS_TOKEN`             | empty   | Permanent System User token with `whatsapp_business_messaging` and `whatsapp_business_management`. |
| `META_PHONE_NUMBER_ID`          | empty   | Meta phone number ID (not the visible phone number).                                               |
| `META_WABA_ID`                  | empty   | WhatsApp Business Account ID.                                                                      |
| `META_APP_SECRET`               | empty   | Meta app secret; required for webhook signature verification.                                      |
| `META_WEBHOOK_VERIFY_TOKEN`     | empty   | Random string you also enter in the Meta webhook configuration.                                    |
| `WHATSAPP_WEBHOOK_PUBLIC_URL`   | empty   | Public HTTPS base URL shown in operations docs, e.g. `https://erp.example.com`.                    |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | `91`    | Calling code used to normalize local numbers.                                                      |

## Safety gates

| Variable                         | Default | Notes                                    |
| -------------------------------- | ------- | ---------------------------------------- |
| `WHATSAPP_SEND_ENABLED`          | `false` | Global master gate for all sends.        |
| `WHATSAPP_CAMPAIGN_SEND_ENABLED` | `false` | Additional gate for marketing campaigns. |

The branch settings page adds three more gates: branch send enabled, branch campaign
enabled, and a kill switch. Every gate must be open before a send is attempted.

## Worker variables

| Variable                          | Default                  | Notes                                                                                     |
| --------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `WHATSAPP_WORKER_INLINE`          | `false`                  | `true` runs the worker inside the API process; production should use a standalone worker. |
| `WHATSAPP_WORKER_POLL_MS`         | `900000`                 | Fallback heartbeat only; work wakes the worker immediately. 30000-3600000 ms.             |
| `WHATSAPP_MAX_WORKER_CONCURRENCY` | `1`                      | Provider send concurrency, 1–20. Keep low for new numbers.                                |
| `WHATSAPP_MAX_ATTEMPTS`           | `5`                      | Maximum outbox attempts, 1–10.                                                            |
| `WHATSAPP_QUEUE_NAME`             | `whatsapp-notifications` | Informational queue name used in status output.                                           |
| `WHATSAPP_WORKER_WINDOW_ENABLED`  | `false`                  | Pause polling outside the send window.                                                    |
| `WHATSAPP_WORKER_WINDOW_START`    | `9`                      | Window start hour, 0–23.                                                                  |
| `WHATSAPP_WORKER_WINDOW_END`      | `21`                     | Window end hour, 0–23.                                                                    |
| `WHATSAPP_WORKER_TIMEZONE`        | `Asia/Kolkata`           | IANA timezone for the window.                                                             |
| `WHATSAPP_OPT_OUT_KEYWORDS`       | built-in list            | Comma-separated override for inbound opt-out keywords.                                    |

## Database and infrastructure

| Variable                | Notes                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string for the API and worker. Use the provider's direct URL unless a pooled URL is required. |
| `DATABASE_URL_UNPOOLED` | Optional direct endpoint used by `prisma migrate deploy`; defaults to `DATABASE_URL`.                               |
| `REDIS_URL`             | Optional rate-limit/cache store. Worker degrades gracefully without it.                                             |
| `JWT_SECRET`            | Must be a long random value; communications API uses it for auth.                                                   |
| `PORT`                  | API port; local default is `4000`.                                                                                  |
| `CORS_ORIGINS`          | Comma-separated allowed origins for the deployed frontend.                                                          |

## Local mock setup

```dotenv
WHATSAPP_PROVIDER=mock
WHATSAPP_SEND_ENABLED=true
WHATSAPP_CAMPAIGN_SEND_ENABLED=true
WHATSAPP_WORKER_INLINE=false
WHATSAPP_WORKER_POLL_MS=5000
```

Then run the API (`npm run dev`) and a worker (`npm run worker:whatsapp`) in a second
terminal. The mock provider records sends and returns fake provider message IDs, so
the full outbox/campaign flow can be exercised without Meta.

## Production Meta setup

```dotenv
WHATSAPP_PROVIDER=meta
META_GRAPH_API_VERSION=v23.0
META_ACCESS_TOKEN=<permanent system user token>
META_PHONE_NUMBER_ID=<phone number id>
META_WABA_ID=<waba id>
META_APP_SECRET=<app secret>
META_WEBHOOK_VERIFY_TOKEN=<random verify token>
WHATSAPP_WEBHOOK_PUBLIC_URL=https://<your-domain>
WHATSAPP_DEFAULT_COUNTRY_CODE=91
WHATSAPP_SEND_ENABLED=false
WHATSAPP_CAMPAIGN_SEND_ENABLED=false
WHATSAPP_WORKER_INLINE=false
```

Enable sends only after webhook verification and template approval are confirmed.
See `META_SETUP_HANDOFF.md`.

## Postgres provider recommendations

- Use a direct Postgres URL for migrations and database copy. Use a pooled URL for the API and worker only when the provider requires it; `DATABASE_URL_UNPOOLED` can point to the direct endpoint.
- For provider changes, run `npm run db:copy:docker -- --yes` with `SOURCE_DATABASE_URL` and `TARGET_DATABASE_URL` set to direct URLs.
- Enable the worker window in production (for example 09:00-21:00 Asia/Kolkata) so the worker does not query the database at night.
- The worker is event-driven: enqueues and campaign actions wake it immediately, with a slow fallback heartbeat (`WHATSAPP_WORKER_POLL_MS`) so paused or scale-to-zero databases are not woken constantly.
- Keep worker concurrency at `1` initially; raise it only after observing stable delivery and error rates.
- Retention defaults to 180 days per branch and is configurable in the UI.
