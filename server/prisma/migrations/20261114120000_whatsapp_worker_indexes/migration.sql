-- Speed up the WhatsApp worker's due-work scans without full table scans.
CREATE INDEX IF NOT EXISTS "whatsapp_campaigns_status_scheduledAt_idx"
  ON "whatsapp_campaigns"("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "whatsapp_outbox_status_lockedAt_idx"
  ON "whatsapp_outbox"("status", "lockedAt");

CREATE INDEX IF NOT EXISTS "whatsapp_reminders_status_dueAt_idx"
  ON "whatsapp_reminders"("status", "dueAt");

CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_status_updated_at_idx"
  ON "whatsapp_webhook_events"("status", "updated_at");
