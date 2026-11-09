-- Replace the legacy WhatsApp message table with the consent-aware Cloud API
-- communications schema. The old table was only used by the removed
-- connection/broadcast implementation.
DROP TABLE IF EXISTS "messages";

CREATE TABLE "whatsapp_preferences" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phoneE164" TEXT,
    "phoneCountry" TEXT,
    "phoneValidationStatus" TEXT NOT NULL DEFAULT 'unknown',
    "consentStatus" TEXT NOT NULL DEFAULT 'unknown',
    "transactionalConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentSource" TEXT,
    "consentCapturedAt" TIMESTAMP(3),
    "consentEvidence" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "lastConsentUpdatedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_preferences_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_templates" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "metaTemplateName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'utility',
    "localStatus" TEXT NOT NULL DEFAULT 'unconfigured',
    "headerType" TEXT NOT NULL DEFAULT 'none',
    "bodyParamCount" INTEGER NOT NULL DEFAULT 0,
    "parameterMap" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "mappedBy" TEXT,
    "mappedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_triggers" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'utility',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_triggers_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_campaigns" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'marketing',
    "templateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "parameterMap" JSONB NOT NULL DEFAULT '[]',
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "audienceMatched" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_campaign_recipients" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessageSafe" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "skipReason" TEXT,
    "lastErrorClass" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_campaign_recipients_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_outbox" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "eventVersion" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "lastErrorClass" TEXT,
    "completedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_outbox_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_messages" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "outboxId" TEXT,
    "campaignId" TEXT,
    "templateId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "messageType" TEXT NOT NULL DEFAULT 'template',
    "category" TEXT,
    "phoneE164" TEXT NOT NULL,
    "templateName" TEXT,
    "languageCode" TEXT,
    "contentPreview" TEXT,
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "errorCode" TEXT,
    "errorMessageSafe" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "mediaId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_webhook_events" (
    "_id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_consent_audits" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "source" TEXT,
    "evidence" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_consent_audits_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_settings" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "campaignSendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 180,
    "updatedBy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_reminder_rules" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "daysAfterBill" INTEGER NOT NULL DEFAULT 7,
    "templateId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_reminder_rules_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "whatsapp_reminders" (
    "_id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outboxId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_reminders_pkey" PRIMARY KEY ("_id")
);

CREATE UNIQUE INDEX "whatsapp_preferences_customerId_key" ON "whatsapp_preferences"("customerId");
CREATE UNIQUE INDEX "whatsapp_preferences_branchId_customerId_key" ON "whatsapp_preferences"("branchId", "customerId");
CREATE INDEX "whatsapp_preferences_branchId_phoneE164_idx" ON "whatsapp_preferences"("branchId", "phoneE164");
CREATE INDEX "whatsapp_preferences_branchId_consentStatus_marketingConsent_idx" ON "whatsapp_preferences"("branchId", "consentStatus", "marketingConsent");
CREATE INDEX "whatsapp_preferences_branchId_phoneValidationStatus_idx" ON "whatsapp_preferences"("branchId", "phoneValidationStatus");

CREATE UNIQUE INDEX "whatsapp_templates_branchId_eventKey_languageCode_key" ON "whatsapp_templates"("branchId", "eventKey", "languageCode");
CREATE INDEX "whatsapp_templates_branchId_localStatus_idx" ON "whatsapp_templates"("branchId", "localStatus");

CREATE UNIQUE INDEX "whatsapp_triggers_branchId_eventKey_key" ON "whatsapp_triggers"("branchId", "eventKey");
CREATE INDEX "whatsapp_triggers_branchId_enabled_idx" ON "whatsapp_triggers"("branchId", "enabled");

CREATE INDEX "whatsapp_campaigns_branchId_status_scheduledAt_idx" ON "whatsapp_campaigns"("branchId", "status", "scheduledAt");
CREATE INDEX "whatsapp_campaigns_branchId_created_at_idx" ON "whatsapp_campaigns"("branchId", "created_at");

CREATE UNIQUE INDEX "whatsapp_campaign_recipients_idempotencyKey_key" ON "whatsapp_campaign_recipients"("idempotencyKey");
CREATE UNIQUE INDEX "whatsapp_campaign_recipients_campaignId_customerId_key" ON "whatsapp_campaign_recipients"("campaignId", "customerId");
CREATE INDEX "whatsapp_campaign_recipients_branchId_status_idx" ON "whatsapp_campaign_recipients"("branchId", "status");
CREATE INDEX "whatsapp_campaign_recipients_campaignId_status_idx" ON "whatsapp_campaign_recipients"("campaignId", "status");
CREATE INDEX "whatsapp_campaign_recipients_providerMessageId_idx" ON "whatsapp_campaign_recipients"("providerMessageId");

CREATE UNIQUE INDEX "whatsapp_outbox_eventId_key" ON "whatsapp_outbox"("eventId");
CREATE INDEX "whatsapp_outbox_status_availableAt_idx" ON "whatsapp_outbox"("status", "availableAt");
CREATE INDEX "whatsapp_outbox_branchId_eventType_created_at_idx" ON "whatsapp_outbox"("branchId", "eventType", "created_at");
CREATE INDEX "whatsapp_outbox_branchId_customerId_created_at_idx" ON "whatsapp_outbox"("branchId", "customerId", "created_at");

CREATE UNIQUE INDEX "whatsapp_messages_providerMessageId_key" ON "whatsapp_messages"("providerMessageId");
CREATE UNIQUE INDEX "whatsapp_messages_idempotencyKey_key" ON "whatsapp_messages"("idempotencyKey");
CREATE INDEX "whatsapp_messages_branchId_created_at_idx" ON "whatsapp_messages"("branchId", "created_at");
CREATE INDEX "whatsapp_messages_branchId_status_created_at_idx" ON "whatsapp_messages"("branchId", "status", "created_at");
CREATE INDEX "whatsapp_messages_branchId_customerId_created_at_idx" ON "whatsapp_messages"("branchId", "customerId", "created_at");
CREATE INDEX "whatsapp_messages_branchId_campaignId_idx" ON "whatsapp_messages"("branchId", "campaignId");
CREATE INDEX "whatsapp_messages_providerMessageId_idx" ON "whatsapp_messages"("providerMessageId");

CREATE UNIQUE INDEX "whatsapp_webhook_events_dedupeKey_key" ON "whatsapp_webhook_events"("dedupeKey");
CREATE INDEX "whatsapp_webhook_events_status_created_at_idx" ON "whatsapp_webhook_events"("status", "created_at");

CREATE INDEX "whatsapp_consent_audits_branchId_customerId_created_at_idx" ON "whatsapp_consent_audits"("branchId", "customerId", "created_at");

CREATE UNIQUE INDEX "whatsapp_settings_branchId_key" ON "whatsapp_settings"("branchId");

CREATE UNIQUE INDEX "whatsapp_reminder_rules_branchId_name_key" ON "whatsapp_reminder_rules"("branchId", "name");
CREATE INDEX "whatsapp_reminder_rules_branchId_enabled_idx" ON "whatsapp_reminder_rules"("branchId", "enabled");

CREATE UNIQUE INDEX "whatsapp_reminders_ruleId_billId_key" ON "whatsapp_reminders"("ruleId", "billId");
CREATE INDEX "whatsapp_reminders_branchId_status_dueAt_idx" ON "whatsapp_reminders"("branchId", "status", "dueAt");
CREATE INDEX "whatsapp_reminders_billId_status_idx" ON "whatsapp_reminders"("billId", "status");

ALTER TABLE "whatsapp_preferences" ADD CONSTRAINT "whatsapp_preferences_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_preferences" ADD CONSTRAINT "whatsapp_preferences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_triggers" ADD CONSTRAINT "whatsapp_triggers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_triggers" ADD CONSTRAINT "whatsapp_triggers_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_campaign_recipients" ADD CONSTRAINT "whatsapp_campaign_recipients_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_campaign_recipients" ADD CONSTRAINT "whatsapp_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_campaign_recipients" ADD CONSTRAINT "whatsapp_campaign_recipients_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_outbox" ADD CONSTRAINT "whatsapp_outbox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "whatsapp_outbox"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_consent_audits" ADD CONSTRAINT "whatsapp_consent_audits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_consent_audits" ADD CONSTRAINT "whatsapp_consent_audits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminder_rules" ADD CONSTRAINT "whatsapp_reminder_rules_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminder_rules" ADD CONSTRAINT "whatsapp_reminder_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminders" ADD CONSTRAINT "whatsapp_reminders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminders" ADD CONSTRAINT "whatsapp_reminders_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "whatsapp_reminder_rules"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminders" ADD CONSTRAINT "whatsapp_reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_reminders" ADD CONSTRAINT "whatsapp_reminders_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
