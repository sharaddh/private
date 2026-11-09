import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import type { NotificationEventInput } from "./types";

type DbClient = typeof prisma | Prisma.TransactionClient;

export function eventIdFor(input: {
  branchId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  eventVersion?: string;
}): string {
  const key = [
    input.branchId,
    input.eventType,
    input.entityType,
    input.entityId,
    input.eventVersion || "v1",
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export async function enqueueEvent(
  input: NotificationEventInput,
  db: DbClient = prisma
): Promise<{ id: string; created: boolean }> {
  const eventId = eventIdFor(input);
  try {
    const row = await db.whatsAppOutbox.create({
      data: {
        branchId: input.branchId,
        eventId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        customerId: input.customerId,
        eventVersion: input.eventVersion || "v1",
        occurredAt: input.occurredAt || new Date(),
        payload: (input.payload || {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { id: row.id, created: true };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      const existing = await db.whatsAppOutbox.findUnique({
        where: { eventId },
        select: { id: true },
      });
      return { id: existing?.id || eventId, created: false };
    }
    throw err;
  }
}

export async function enqueueEventSafely(input: NotificationEventInput): Promise<void> {
  try {
    await enqueueEvent(input);
  } catch (err) {
    logger.error("Failed to persist WhatsApp outbox event", {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      error: (err as Error).message,
    });
  }
}

export function orderStatusEvent(status: string): NotificationEventInput["eventType"] | null {
  switch (status) {
    case "Ordered":
      return "ORDER_CONFIRMED";
    case "In Lab":
      return "ORDER_PROCESSING";
    case "Ready":
      return "ORDER_READY";
    case "Delivered":
      return "ORDER_DELIVERED";
    case "Cancelled":
      return "ORDER_CANCELLED";
    default:
      return null;
  }
}

export function paymentEventType(pendingAmount: number): NotificationEventInput["eventType"] {
  return pendingAmount > 0 ? "PAYMENT_PARTIALLY_RECEIVED" : "PAYMENT_RECEIVED";
}
