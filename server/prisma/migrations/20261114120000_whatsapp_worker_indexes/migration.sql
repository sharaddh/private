-- Speed up the WhatsApp worker's due-work scans without full table scans.
CREATE INDEX "whatsapp_campaigns_status_scheduledAt_idx"
  ON "whatsapp_campaigns"("status", "scheduledAt");

CREATE INDEX "whatsapp_outbox_status_lockedAt_idx"
  ON "whatsapp_outbox"("status", "lockedAt");

CREATE INDEX "whatsapp_reminders_status_dueAt_idx"
  ON "whatsapp_reminders"("status", "dueAt");

CREATE INDEX "whatsapp_webhook_events_status_updatedAt_idx"
  ON "whatsapp_webhook_events"("status", "updatedAt");
