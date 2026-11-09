import { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import type { BranchRequest } from "../types";
import { maskPhone } from "../whatsapp/phone";
import { getStatus, getBranchSettings, updateBranchSettings } from "../whatsapp/settings";
import { getConsentAudit, getCustomerPreferenceView, updateConsent } from "../whatsapp/consent";
import {
  createTemplate,
  listTemplates,
  listTriggers,
  updateTemplate,
  updateTrigger,
} from "../whatsapp/templates";
import {
  cancelCampaign,
  cloneCampaign,
  createCampaign,
  getCampaignAnalytics,
  listCampaignRecipients,
  listCampaigns,
  pauseCampaign,
  previewCampaign,
  resumeCampaign,
  retryCampaignFailures,
  scheduleCampaign,
  startCampaignNow,
  updateCampaign,
} from "../whatsapp/campaign";
import { getOutboxQueueStats } from "../whatsapp/outbox";
import {
  deleteReminderRule,
  getReminderSummary,
  listReminderRules,
  saveReminderRule,
} from "../whatsapp/reminders";

function branchIdOf(req: BranchRequest): string {
  if (!req.branchId) throw new AppError(400, "Branch context is required");
  return req.branchId;
}

function actorOf(req: BranchRequest) {
  return {
    id: req.user?.sub,
    name: req.user?.username,
  };
}

export async function getCommunicationsStatus(req: BranchRequest, res: Response) {
  const branchId = branchIdOf(req);
  const [status, queue, reminders, campaignCounts, messages] = await Promise.all([
    getStatus(branchId),
    getOutboxQueueStats(branchId),
    getReminderSummary(branchId),
    prisma.whatsAppCampaign.groupBy({
      by: ["status"],
      where: { branchId },
      _count: true,
    }),
    prisma.whatsAppMessage.groupBy({
      by: ["status"],
      where: { branchId, direction: "outbound" },
      _count: true,
    }),
  ]);
  res.json({
    success: true,
    data: {
      ...status,
      queue: { ...status.queue, byStatus: queue },
      reminders,
      campaigns: Object.fromEntries(
        campaignCounts.map((row) => [row.status, row._count])
      ),
      messages: Object.fromEntries(messages.map((row) => [row.status, row._count])),
    },
  });
}

export async function getAudit(req: BranchRequest, res: Response) {
  res.json({ success: true, data: await getConsentAudit(branchIdOf(req)) });
}

export async function getTriggers(req: BranchRequest, res: Response) {
  res.json({ success: true, data: await listTriggers(branchIdOf(req)) });
}

export async function patchTrigger(req: BranchRequest, res: Response) {
  const data = await updateTrigger(branchIdOf(req), req.params.id, {
    ...req.body,
    updatedBy: req.user?.sub,
  });
  res.json({ success: true, data });
}

export async function getTemplates(req: BranchRequest, res: Response) {
  res.json({ success: true, data: await listTemplates(branchIdOf(req)) });
}

export async function postTemplate(req: BranchRequest, res: Response) {
  const data = await createTemplate(branchIdOf(req), {
    ...req.body,
    mappedBy: req.user?.sub,
  });
  res.status(201).json({ success: true, data });
}

export async function patchTemplate(req: BranchRequest, res: Response) {
  const data = await updateTemplate(branchIdOf(req), req.params.id, {
    ...req.body,
    mappedBy: req.user?.sub,
  });
  res.json({ success: true, data });
}

export async function getCampaigns(req: BranchRequest, res: Response) {
  const result = await listCampaigns(branchIdOf(req), req.query as Record<string, string>);
  res.json({ success: true, ...result });
}

export async function postCampaign(req: BranchRequest, res: Response) {
  const data = await createCampaign(branchIdOf(req), {
    ...req.body,
    createdBy: req.user?.sub,
  });
  res.status(201).json({ success: true, data });
}

export async function getCampaign(req: BranchRequest, res: Response) {
  const data = await getCampaignAnalytics(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function patchCampaign(req: BranchRequest, res: Response) {
  const data = await updateCampaign(branchIdOf(req), req.params.id, req.body);
  res.json({ success: true, data });
}

export async function postCampaignPreview(req: BranchRequest, res: Response) {
  const data = await previewCampaign(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignSchedule(req: BranchRequest, res: Response) {
  const data = await scheduleCampaign(
    branchIdOf(req),
    req.params.id,
    req.body.scheduledAt
  );
  res.json({ success: true, data });
}

export async function postCampaignStart(req: BranchRequest, res: Response) {
  const data = await startCampaignNow(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignPause(req: BranchRequest, res: Response) {
  const data = await pauseCampaign(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignResume(req: BranchRequest, res: Response) {
  const data = await resumeCampaign(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignCancel(req: BranchRequest, res: Response) {
  const data = await cancelCampaign(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignRetry(req: BranchRequest, res: Response) {
  const data = await retryCampaignFailures(branchIdOf(req), req.params.id);
  res.json({ success: true, data });
}

export async function postCampaignClone(req: BranchRequest, res: Response) {
  const data = await cloneCampaign(branchIdOf(req), req.params.id, req.user?.sub);
  res.status(201).json({ success: true, data });
}

export async function getCampaignRecipients(req: BranchRequest, res: Response) {
  const result = await listCampaignRecipients(
    branchIdOf(req),
    req.params.id,
    req.query as Record<string, string>
  );
  res.json({ success: true, ...result });
}

export async function getLogs(req: BranchRequest, res: Response) {
  const branchId = branchIdOf(req);
  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit || "25"), 10) || 25)
  );
  const search = String(req.query.search || "").trim();
  const where: Prisma.WhatsAppMessageWhereInput = { branchId };

  if (req.query.status) where.status = String(req.query.status);
  if (req.query.category) where.category = String(req.query.category);
  if (req.query.eventType) {
    where.outbox = { is: { eventType: String(req.query.eventType) } };
  }
  if (req.query.from || req.query.to) {
    where.createdAt = {
      ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
      ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}),
    };
  }
  if (search) {
    const matchingBills = await prisma.bill.findMany({
      where: { branchId, billNumber: { contains: search, mode: "insensitive" } },
      select: { id: true },
      take: 100,
    });
    where.OR = [
      { providerMessageId: { contains: search, mode: "insensitive" } },
      { templateName: { contains: search, mode: "insensitive" } },
      { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
      { customer: { is: { mobile: { contains: search } } } },
      { outbox: { is: { entityId: search } } },
      ...(matchingBills.length > 0
        ? [{ outbox: { is: { entityId: { in: matchingBills.map((bill) => bill.id) } } } }]
        : []),
    ];
  }

  const sort = req.query.sort === "status" ? "status" : "createdAt";
  const order = req.query.order === "asc" ? "asc" : "desc";
  const [rows, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerId: true } },
        campaign: { select: { id: true, name: true, status: true } },
        outbox: {
          select: {
            eventType: true,
            entityType: true,
            entityId: true,
            lastErrorClass: true,
          },
        },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppMessage.count({ where }),
  ]);

  res.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      idempotencyKey: undefined,
      phoneE164: undefined,
      phoneMasked: maskPhone(row.phoneE164),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function getLogDetail(req: BranchRequest, res: Response) {
  const branchId = branchIdOf(req);
  const message = await prisma.whatsAppMessage.findFirst({
    where: { id: req.params.id, branchId },
    include: {
      customer: { select: { id: true, name: true, customerId: true, mobile: true } },
      campaign: { select: { id: true, name: true, status: true } },
      template: true,
      outbox: true,
    },
  });
  if (!message) throw new AppError(404, "Message log not found");
  res.json({
    success: true,
    data: {
      ...message,
      idempotencyKey: undefined,
      phoneE164: undefined,
      phoneMasked: maskPhone(message.phoneE164),
      customer: message.customer
        ? { ...message.customer, mobile: maskPhone(message.customer.mobile) }
        : null,
    },
  });
}

export async function getCustomerPreferences(req: BranchRequest, res: Response) {
  res.json({
    success: true,
    data: await getCustomerPreferenceView(branchIdOf(req), req.params.customerId),
  });
}

export async function patchCustomerPreferences(req: BranchRequest, res: Response) {
  const data = await updateConsent(
    branchIdOf(req),
    req.params.customerId,
    req.body,
    actorOf(req)
  );
  res.json({ success: true, data });
}

export async function getSettings(req: BranchRequest, res: Response) {
  res.json({ success: true, data: await getBranchSettings(branchIdOf(req)) });
}

export async function patchSettings(req: BranchRequest, res: Response) {
  const data = await updateBranchSettings(branchIdOf(req), {
    ...req.body,
    updatedBy: req.user?.sub,
  });
  res.json({ success: true, data });
}

export async function getReminderRules(req: BranchRequest, res: Response) {
  res.json({ success: true, data: await listReminderRules(branchIdOf(req)) });
}

export async function postReminderRule(req: BranchRequest, res: Response) {
  const data = await saveReminderRule(
    branchIdOf(req),
    { ...req.body, id: undefined },
    req.user?.sub
  );
  res.status(201).json({ success: true, data });
}

export async function patchReminderRule(req: BranchRequest, res: Response) {
  const branchId = branchIdOf(req);
  const existing = await prisma.whatsAppReminderRule.findFirst({
    where: { id: req.params.id, branchId },
  });
  if (!existing) throw new AppError(404, "Reminder rule not found");
  if (req.body.templateId) {
    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id: req.body.templateId, branchId },
    });
    if (!template || template.eventKey !== "PAYMENT_BALANCE_DUE") {
      throw new AppError(400, "Select a payment reminder template");
    }
    if (req.body.enabled && template.localStatus !== "approved_confirmed") {
      throw new AppError(400, "Confirm the template as approved before enabling reminders");
    }
  }
  if (req.body.enabled && !(req.body.templateId || existing.templateId)) {
    throw new AppError(400, "Select an approved template before enabling reminders");
  }
  const data = await saveReminderRule(
    branchId,
    { ...req.body, id: existing.id },
    req.user?.sub
  );
  res.json({ success: true, data });
}

export async function deleteReminderRuleHandler(req: BranchRequest, res: Response) {
  const deleted = await deleteReminderRule(branchIdOf(req), req.params.id);
  if (!deleted) throw new AppError(404, "Reminder rule not found");
  res.json({ success: true });
}
