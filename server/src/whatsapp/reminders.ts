import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { enqueueEvent } from "./events";

export async function scheduleRemindersForBill(branchId: string, billId: string) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, branchId },
    select: {
      id: true,
      customerId: true,
      pendingAmount: true,
      status: true,
      createdAt: true,
    },
  });
  if (!bill || bill.status !== "Active" || bill.pendingAmount <= 0) return 0;

  const rules = await prisma.whatsAppReminderRule.findMany({
    where: { branchId, enabled: true },
    select: { id: true, daysAfterBill: true },
  });
  let created = 0;
  for (const rule of rules) {
    const dueAt = new Date(bill.createdAt.getTime() + rule.daysAfterBill * 86400000);
    try {
      await prisma.whatsAppReminder.create({
        data: {
          branchId,
          ruleId: rule.id,
          billId: bill.id,
          customerId: bill.customerId,
          dueAt,
          status: "pending",
        },
      });
      created += 1;
    } catch (err) {
      if (!(err && typeof err === "object" && (err as { code?: string }).code === "P2002")) {
        throw err;
      }
    }
  }
  return created;
}

export async function cancelRemindersForBill(
  billId: string,
  reason = "bill_settled_or_cancelled"
) {
  return prisma.whatsAppReminder.updateMany({
    where: { billId, status: "pending" },
    data: { status: "cancelled" },
    // Keep the skip reason on the outbox, not the reminder row, to avoid an
    // unplanned schema migration. The cancellation reason is logged for audit.
  }).then((result) => {
    if (result.count > 0) {
      logger.info("Cancelled pending WhatsApp reminders", { billId, reason, count: result.count });
    }
    return result.count;
  });
}

export async function processDueReminders(limit = 20): Promise<number> {
  const due = await prisma.whatsAppReminder.findMany({
    where: { status: "pending", dueAt: { lte: new Date() } },
    include: {
      rule: { include: { template: true } },
      bill: {
        select: {
          id: true,
          branchId: true,
          customerId: true,
          billNumber: true,
          pendingAmount: true,
          status: true,
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });

  let queued = 0;
  for (const reminder of due) {
    const claimed = await prisma.whatsAppReminder.updateMany({
      where: { id: reminder.id, status: "pending" },
      data: { status: "queued" },
    });
    if (claimed.count !== 1) continue;

    if (!reminder.rule.enabled) {
      await prisma.whatsAppReminder.update({
        where: { id: reminder.id },
        data: { status: "skipped" },
      });
      continue;
    }
    if (
      reminder.bill.status !== "Active" ||
      reminder.bill.pendingAmount <= 0 ||
      reminder.bill.branchId !== reminder.branchId
    ) {
      await prisma.whatsAppReminder.update({
        where: { id: reminder.id },
        data: { status: "skipped" },
      });
      continue;
    }
    if (!reminder.rule.template || reminder.rule.template.localStatus !== "approved_confirmed") {
      await prisma.whatsAppReminder.update({
        where: { id: reminder.id },
        data: { status: "skipped" },
      });
      logger.warn("Reminder skipped because template is not approved", {
        reminderId: reminder.id,
        ruleId: reminder.ruleId,
      });
      continue;
    }

    try {
      const outbox = await enqueueEvent({
        eventType: "PAYMENT_BALANCE_DUE",
        entityType: "invoice",
        entityId: reminder.billId,
        customerId: reminder.customerId,
        branchId: reminder.branchId,
        eventVersion: `reminder:${reminder.id}`,
        payload: {
          billId: reminder.billId,
          billNumber: reminder.bill.billNumber,
          reminderId: reminder.id,
          templateId: reminder.rule.templateId,
        },
      });
      await prisma.whatsAppReminder.update({
        where: { id: reminder.id },
        data: { status: "completed", outboxId: outbox.id },
      });
      queued += 1;
    } catch (err) {
      await prisma.whatsAppReminder.update({
        where: { id: reminder.id },
        data: { status: "skipped" },
      });
      logger.error("Failed to enqueue WhatsApp reminder", {
        reminderId: reminder.id,
        error: (err as Error).message,
      });
    }
  }
  return queued;
}

export async function listReminderRules(branchId: string) {
  return prisma.whatsAppReminderRule.findMany({
    where: { branchId },
    include: { template: true },
    orderBy: { daysAfterBill: "asc" },
  });
}

export async function saveReminderRule(
  branchId: string,
  input: {
    id?: string;
    name?: string;
    enabled?: boolean;
    daysAfterBill?: number;
    templateId?: string | null;
  },
  actorId?: string
) {
  if (input.id) {
    return prisma.whatsAppReminderRule.update({
      where: { id: input.id },
      data: {
        name: input.name,
        enabled: input.enabled,
        daysAfterBill: input.daysAfterBill,
        templateId: input.templateId,
        updatedBy: actorId,
      },
    });
  }
  return prisma.whatsAppReminderRule.create({
    data: {
      branchId,
      name: input.name || `${input.daysAfterBill || 7} day reminder`,
      enabled: Boolean(input.enabled),
      daysAfterBill: input.daysAfterBill || 7,
      templateId: input.templateId || null,
      createdBy: actorId,
    },
  });
}

export async function deleteReminderRule(branchId: string, id: string) {
  const rule = await prisma.whatsAppReminderRule.findFirst({ where: { id, branchId } });
  if (!rule) return false;
  await prisma.whatsAppReminder.updateMany({
    where: { ruleId: id, status: "pending" },
    data: { status: "cancelled" },
  });
  await prisma.whatsAppReminderRule.delete({ where: { id } });
  return true;
}

export async function getReminderSummary(branchId: string) {
  const [pending, queued, skipped, rules] = await Promise.all([
    prisma.whatsAppReminder.count({ where: { branchId, status: "pending" } }),
    prisma.whatsAppReminder.count({ where: { branchId, status: "queued" } }),
    prisma.whatsAppReminder.count({ where: { branchId, status: "skipped" } }),
    prisma.whatsAppReminderRule.count({ where: { branchId, enabled: true } }),
  ]);
  return { pending, queued, skipped, enabledRules: rules };
}
