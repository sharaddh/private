# Meta WhatsApp Setup and Handoff

Use this checklist to move from the local mock provider to live WhatsApp Cloud API
messaging. Complete it in order; do not enable sending until the acceptance section
passes.

## 1. Meta business prerequisites

- [ ] Create or use a Meta Business account for KMJ Optical.
- [ ] Complete Business Verification in Meta Business Suite.
- [ ] Create a Meta developer app of type **Business**.
- [ ] Add the **WhatsApp** product to the app.
- [ ] Add a payment method to the WhatsApp Business Account for production messaging.

## 2. Phone number and WhatsApp Business Account

- [ ] Add a dedicated business phone number (not a number already active on the
      WhatsApp consumer app, unless migrated deliberately).
- [ ] Register the number for the Cloud API and complete display-name review.
- [ ] Record the **Phone Number ID** and **WhatsApp Business Account (WABA) ID**.
- [ ] Start with the Meta test number for end-to-end validation if production review
      is still pending.

## 3. Permanent access token

- [ ] Create a System User in Meta Business Suite.
- [ ] Assign the WhatsApp Business Account and the app to the System User.
- [ ] Grant `whatsapp_business_messaging` and `whatsapp_business_management`.
- [ ] Generate a permanent token and store it only in the server environment.
- [ ] Confirm the token can call `GET /{phone-number-id}` on Graph API.

## 4. App secret and webhook verify token

- [ ] Copy the app secret from the Meta app dashboard.
- [ ] Generate a long random verify token and store it securely.
- [ ] Decide the public HTTPS domain for the ERP (for example `erp.kmjoptical.com`).

## 5. Server environment

Set these values in `server/.env` on the deployed server and restart:

```dotenv
WHATSAPP_PROVIDER=meta
META_GRAPH_API_VERSION=v23.0
META_ACCESS_TOKEN=<permanent token>
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

For Neon production:

```dotenv
DATABASE_URL=<pooled connection string>
DATABASE_URL_UNPOOLED=<direct connection string>
WHATSAPP_WORKER_WINDOW_ENABLED=true
WHATSAPP_WORKER_WINDOW_START=9
WHATSAPP_WORKER_WINDOW_END=21
WHATSAPP_WORKER_TIMEZONE=Asia/Kolkata
```

## 6. Webhook configuration in Meta

- [ ] Callback URL: `https://<your-domain>/api/webhooks/whatsapp`
- [ ] Verify token: exactly the value of `META_WEBHOOK_VERIFY_TOKEN`.
- [ ] Subscribe to the `messages` webhook field.
- [ ] Click **Verify and save**; Meta must receive the challenge response.
- [ ] Send a test message and confirm it appears in the Communications log.
- [ ] Confirm `GET /api/communications/status` shows `appSecretSet` and
      `verifyTokenSet` as true.

## 7. Templates

- [ ] Submit the utility and marketing templates from `meta-template-drafts.md`.
- [ ] Use the exact template names and language code used in the app mapping.
- [ ] Wait for **Approved** status in WhatsApp Manager.
- [ ] In the Communications → Templates tab, map each event to its approved template
      and paste the parameter order map.
- [ ] Validate with the Preview action before sending to customers.

Template names expected by the app:

`kmj_order_confirmation`, `kmj_order_processing`, `kmj_order_ready`,
`kmj_order_delivered`, `kmj_order_cancelled`, `kmj_payment_received`,
`kmj_payment_partial`, `kmj_payment_reminder`, `kmj_invoice_document`,
`kmj_promotional_offer`.

## 8. Staged enablement

1. Start the standalone worker.
2. Send an order notification to an internal test number.
3. Confirm status `sent` → `delivered` and a webhook event.
4. Enable branch sending and the global send gate.
5. Send one real transactional message with staff approval.
6. Submit and approve marketing templates; enable campaign sending last.

## 9. Acceptance checklist

- [ ] `GET /api/communications/status` shows `provider: meta`, configured, and no
      missing variables.
- [ ] Webhook verification succeeds and delivery statuses update in the UI.
- [ ] Invalid webhook signatures are rejected.
- [ ] Transactional messages reach `delivered` for a valid customer.
- [ ] Opted-out customers are skipped and appear in logs as ineligible.
- [ ] Campaign preview counts match expectations before starting.
- [ ] Kill switch stops both transactional and campaign sends.
- [ ] Queue failures and unknown submissions are visible and actionable.

## 10. Rollback

- Enable the branch kill switch first, then set `WHATSAPP_SEND_ENABLED=false`.
- Keep the worker running so webhooks and retention continue.
- Do not delete webhook events or consent audit rows during an incident.
- Re-enable in reverse order after the root cause is fixed and a test send passes.
