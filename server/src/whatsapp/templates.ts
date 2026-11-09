import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  WHATSAPP_EVENTS,
  getEventDefinition,
  type WhatsAppCategory,
  type WhatsAppTemplateParameterMapping,
} from "./types";
import type { Prisma } from "@prisma/client";

export const TEMPLATE_STATUSES = [
  "unconfigured",
  "configured",
  "awaiting_external_confirmation",
  "approved_confirmed",
  "rejected",
] as const;

export class TemplateMappingError extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = "TemplateMappingError";
    this.reason = reason;
  }
}

export function parseParameterMap(value: unknown): WhatsAppTemplateParameterMapping[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const key = String(record.key || "").trim();
      const source = String(record.source || "").trim();
      return key && source ? { key, source } : null;
    })
    .filter(Boolean) as WhatsAppTemplateParameterMapping[];
}

export async function ensureWhatsAppDefaults(branchId: string) {
  await prisma.whatsAppSetting.upsert({
    where: { branchId },
    create: { branchId },
    update: {},
  });

  await prisma.whatsAppTemplate.createMany({
    data: WHATSAPP_EVENTS.map((event) => ({
      branchId,
      eventKey: event.key,
      metaTemplateName: event.defaultTemplateName,
      languageCode: "en",
      category: event.category,
      localStatus: "unconfigured",
      headerType: event.headerType,
      bodyParamCount: event.parameters.length,
      parameterMap: event.parameters.map((param) => ({ key: param.key, source: param.key })),
    })),
    skipDuplicates: true,
  });

  const templates = await prisma.whatsAppTemplate.findMany({
    where: { branchId, languageCode: "en" },
    select: { id: true, eventKey: true, category: true },
  });
  const byEvent = new Map(templates.map((template) => [template.eventKey, template]));

  await prisma.whatsAppTrigger.createMany({
    data: WHATSAPP_EVENTS.filter((event) => !event.campaignOnly).map((event) => {
      const template = byEvent.get(event.key);
      return {
        branchId,
        eventKey: event.key,
        category: event.category,
        enabled: false,
        templateId: template?.id,
      };
    }),
    skipDuplicates: true,
  });

  const reminderTemplate = byEvent.get("PAYMENT_BALANCE_DUE");
  for (const [name, days] of [
    ["7-day payment reminder", 7],
    ["14-day payment reminder", 14],
  ] as const) {
    await prisma.whatsAppReminderRule.upsert({
      where: { branchId_name: { branchId, name } },
      create: {
        branchId,
        name,
        enabled: false,
        daysAfterBill: days,
        templateId: reminderTemplate?.id,
      },
      update: {},
    });
  }
}

export async function listTemplates(branchId: string) {
  await ensureWhatsAppDefaults(branchId);
  return prisma.whatsAppTemplate.findMany({
    where: { branchId },
    orderBy: [{ category: "asc" }, { eventKey: "asc" }],
  });
}

export async function listTriggers(branchId: string) {
  await ensureWhatsAppDefaults(branchId);
  return prisma.whatsAppTrigger.findMany({
    where: { branchId },
    include: { template: true },
    orderBy: { eventKey: "asc" },
  });
}

interface TemplateInput {
  metaTemplateName?: string;
  languageCode?: string;
  category?: WhatsAppCategory;
  localStatus?: string;
  headerType?: "none" | "document" | "text";
  bodyParamCount?: number;
  parameterMap?: WhatsAppTemplateParameterMapping[];
  notes?: string | null;
  mappedBy?: string;
}

export async function createTemplate(
  branchId: string,
  input: TemplateInput & { eventKey: string; metaTemplateName: string }
) {
  const event = getEventDefinition(input.eventKey);
  if (!event) throw new AppError(400, "Unknown WhatsApp event");
  const languageCode = (input.languageCode || "en").trim();
  const metaTemplateName = input.metaTemplateName.trim();
  if (!languageCode || !metaTemplateName) {
    throw new AppError(400, "Meta template name and language code are required");
  }
  const category = input.category || event.category;
  if (category !== "utility" && category !== "marketing") {
    throw new AppError(400, "Category must be utility or marketing");
  }
  if (event.campaignOnly && category !== "marketing") {
    throw new AppError(400, "Campaign templates must use the marketing category");
  }
  const parameterMap =
    input.parameterMap !== undefined
      ? parseParameterMap(input.parameterMap)
      : event.parameters.map((parameter) => ({
          key: parameter.key,
          source: parameter.key,
        }));
  const bodyParamCount = Math.max(0, Number(input.bodyParamCount ?? parameterMap.length));
  if (parameterMap.length !== bodyParamCount) {
    throw new AppError(400, "Parameter mapping count must match the body parameter count");
  }
  const status = input.localStatus || "unconfigured";
  if (!(TEMPLATE_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, "Invalid template status");
  }
  try {
    return await prisma.whatsAppTemplate.create({
      data: {
        branchId,
        eventKey: event.key,
        metaTemplateName,
        languageCode,
        category,
        localStatus: status,
        headerType: input.headerType || event.headerType,
        bodyParamCount,
        parameterMap: parameterMap as Prisma.InputJsonValue,
        notes: input.notes || null,
        mappedBy: input.mappedBy,
        mappedAt: status === "approved_confirmed" ? new Date() : null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      throw new AppError(409, "A mapping already exists for this event and language");
    }
    throw err;
  }
}

export async function updateTemplate(branchId: string, id: string, input: TemplateInput) {
  const existing = await prisma.whatsAppTemplate.findFirst({ where: { id, branchId } });
  if (!existing) throw new AppError(404, "Template mapping not found");

  const event = getEventDefinition(existing.eventKey);
  const status = input.localStatus || existing.localStatus;
  if (!(TEMPLATE_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, "Invalid template status");
  }
  const languageCode = (input.languageCode || existing.languageCode).trim();
  if (!languageCode) throw new AppError(400, "Language code is required");
  const templateName = (input.metaTemplateName || existing.metaTemplateName).trim();
  if (!templateName) throw new AppError(400, "Meta template name is required");

  const parameterMap =
    input.parameterMap !== undefined ? parseParameterMap(input.parameterMap) : parseParameterMap(existing.parameterMap);
  const bodyParamCount = Math.max(0, Number(input.bodyParamCount ?? existing.bodyParamCount));
  if (parameterMap.length !== bodyParamCount) {
    throw new AppError(400, "Parameter mapping count must match the body parameter count");
  }
  const category = input.category || (existing.category as WhatsAppCategory);
  if (category !== "utility" && category !== "marketing") {
    throw new AppError(400, "Category must be utility or marketing");
  }
  if (event && event.campaignOnly && category !== "marketing") {
    throw new AppError(400, "Campaign templates must use the marketing category");
  }

  const approved = status === "approved_confirmed";
  return prisma.whatsAppTemplate.update({
    where: { id },
    data: {
      metaTemplateName: templateName,
      languageCode,
      category,
      localStatus: status,
      headerType: input.headerType || existing.headerType,
      bodyParamCount,
      parameterMap: parameterMap as Prisma.InputJsonValue,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      mappedAt: approved ? new Date() : existing.mappedAt,
    },
  });
}

interface TriggerInput {
  enabled?: boolean;
  templateId?: string | null;
  category?: WhatsAppCategory;
  conditions?: Record<string, unknown>;
  updatedBy?: string;
}

export async function updateTrigger(branchId: string, id: string, input: TriggerInput) {
  const existing = await prisma.whatsAppTrigger.findFirst({
    where: { id, branchId },
    include: { template: true },
  });
  if (!existing) throw new AppError(404, "Trigger not found");

  let templateId = input.templateId !== undefined ? input.templateId : existing.templateId;
  if (templateId) {
    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id: templateId, branchId },
    });
    if (!template) throw new AppError(400, "Template mapping not found");
    if (template.eventKey !== existing.eventKey) {
      throw new AppError(400, "Template event does not match this trigger");
    }
    if (input.enabled && template.localStatus !== "approved_confirmed") {
      throw new AppError(
        400,
        "Confirm the Meta template as approved before enabling this trigger"
      );
    }
    templateId = template.id;
  } else if (input.enabled) {
    throw new AppError(400, "Select an approved template before enabling this trigger");
  }

  const category = input.category || (existing.category as WhatsAppCategory);
  if (category !== "utility" && category !== "marketing") {
    throw new AppError(400, "Category must be utility or marketing");
  }

  return prisma.whatsAppTrigger.update({
    where: { id },
    data: {
      enabled: input.enabled ?? existing.enabled,
      templateId,
      category,
      conditions: (input.conditions ?? existing.conditions) as any,
      updatedBy: input.updatedBy,
    },
  });
}

export async function getApprovedTemplateForEvent(
  branchId: string,
  eventKey: string,
  languageCode = "en",
  templateId?: string | null
) {
  const template = templateId
    ? await prisma.whatsAppTemplate.findFirst({
        where: { id: templateId, branchId },
      })
    : await prisma.whatsAppTemplate.findFirst({
        where: { branchId, eventKey, languageCode },
      });
  if (!template) throw new TemplateMappingError("Template mapping is missing", "missing_template");
  if (template.eventKey !== eventKey) {
    throw new TemplateMappingError(
      "Template event does not match this notification",
      "template_event_mismatch"
    );
  }
  if (template.localStatus !== "approved_confirmed") {
    throw new TemplateMappingError(
      "Template is not confirmed approved in Meta",
      "template_not_approved"
    );
  }
  return template;
}

export function resolveTemplateParameters(
  template: { parameterMap: unknown; bodyParamCount: number },
  context: Record<string, string | number | null | undefined>
): string[] {
  const mapping = parseParameterMap(template.parameterMap);
  if (mapping.length !== template.bodyParamCount) {
    throw new TemplateMappingError(
      "Template parameter mapping is incomplete",
      "invalid_parameter_map"
    );
  }
  return mapping.map((parameter) => {
    const raw = context[parameter.source];
    const value = raw === undefined || raw === null ? "" : String(raw).trim();
    if (!value) {
      throw new TemplateMappingError(
        `Missing template value for "${parameter.key}"`,
        `missing_value:${parameter.source}`
      );
    }
    if (value.length > 900) {
      throw new TemplateMappingError(
        `Template value for "${parameter.key}" is too long`,
        `value_too_long:${parameter.source}`
      );
    }
    return value.replace(/[\r\n]+/g, " ");
  });
}

export function renderTemplatePreview(
  template: { parameterMap: unknown; bodyParamCount: number },
  context: Record<string, string | number | null | undefined>
): Array<{ key: string; value: string }> {
  return parseParameterMap(template.parameterMap).map((parameter, index) => ({
    key: parameter.key || `parameter_${index + 1}`,
    value: String(context[parameter.source] ?? `[${parameter.key}]`),
  }));
}
