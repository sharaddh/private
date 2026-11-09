import { z } from "zod";

const parameterMappingSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
});

export const triggerUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    templateId: z.string().min(1).nullable().optional(),
    category: z.enum(["utility", "marketing"]).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const templateCreateSchema = z
  .object({
    eventKey: z.string().min(1),
    metaTemplateName: z.string().min(1).max(200),
    languageCode: z.string().min(2).max(20).optional(),
    category: z.enum(["utility", "marketing"]).optional(),
    localStatus: z
      .enum(["unconfigured", "configured", "awaiting_external_confirmation", "approved_confirmed", "rejected"])
      .optional(),
    headerType: z.enum(["none", "document", "text"]).optional(),
    bodyParamCount: z.number().int().min(0).max(20).optional(),
    parameterMap: z.array(parameterMappingSchema).max(20).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const templateUpdateSchema = templateCreateSchema
  .omit({ eventKey: true, metaTemplateName: true })
  .extend({ metaTemplateName: z.string().min(1).max(200).optional() })
  .strict();

const audienceFilterSchema = z
  .object({
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    tags: z.array(z.string()).max(50).optional(),
    city: z.string().max(100).optional(),
    minTotalSpent: z.coerce.number().min(0).optional(),
    maxTotalSpent: z.coerce.number().min(0).optional(),
    hasPending: z.boolean().optional(),
    inactiveDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .strict();

export const campaignCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    purpose: z.enum(["marketing", "utility"]),
    templateId: z.string().min(1),
    audienceFilter: audienceFilterSchema.optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    timezone: z.string().max(100).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const campaignUpdateSchema = campaignCreateSchema
  .partial()
  .extend({ name: z.string().trim().min(1).max(200).optional() })
  .strict();

export const campaignScheduleSchema = z
  .object({ scheduledAt: z.string().datetime().optional() })
  .strict();

export const campaignListQuerySchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().max(50).optional(),
  })
  .strict();

export const recipientListQuerySchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().max(50).optional(),
  })
  .strict();

export const consentUpdateSchema = z
  .object({
    consentStatus: z.enum(["unknown", "opted_in", "opted_out"]),
    transactionalConsent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
    source: z.string().max(100).optional(),
    evidence: z.string().max(1000).optional(),
  })
  .strict();

export const settingsUpdateSchema = z
  .object({
    sendEnabled: z.boolean().optional(),
    campaignSendEnabled: z.boolean().optional(),
    killSwitch: z.boolean().optional(),
    reminderEnabled: z.boolean().optional(),
    retentionDays: z.number().int().min(30).max(3650).optional(),
  })
  .strict();

export const logsQuerySchema = z
  .object({
    search: z.string().max(200).optional(),
    status: z.string().max(50).optional(),
    eventType: z.string().max(100).optional(),
    category: z.enum(["utility", "marketing"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.enum(["createdAt", "status"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export const reminderRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    daysAfterBill: z.number().int().min(1).max(365).optional(),
    templateId: z.string().min(1).nullable().optional(),
  })
  .strict();
