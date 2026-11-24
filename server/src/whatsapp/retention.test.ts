import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { purgeExpiredWhatsAppData } from "./retention";

vi.mock("../db/prisma", () => ({
  prisma: {
    whatsAppSetting: { findMany: vi.fn() },
    whatsAppMessage: { deleteMany: vi.fn() },
    whatsAppOutbox: { deleteMany: vi.fn() },
    whatsAppReminder: { deleteMany: vi.fn() },
    whatsAppWebhookEvent: { deleteMany: vi.fn() },
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), audit: vi.fn() },
}));

const now = new Date("2026-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.whatsAppSetting.findMany).mockResolvedValue([
    { branchId: "branch-a", retentionDays: 10 },
    { branchId: "branch-b", retentionDays: null },
  ] as unknown as Awaited<ReturnType<typeof prisma.whatsAppSetting.findMany>>);
  vi.mocked(prisma.whatsAppMessage.deleteMany)
    .mockResolvedValueOnce({ count: 2 })
    .mockResolvedValueOnce({ count: 3 });
  vi.mocked(prisma.whatsAppOutbox.deleteMany)
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 4 });
  vi.mocked(prisma.whatsAppReminder.deleteMany)
    .mockResolvedValueOnce({ count: 5 })
    .mockResolvedValueOnce({ count: 6 });
  vi.mocked(prisma.whatsAppWebhookEvent.deleteMany).mockResolvedValue({ count: 7 });
});

describe("purgeExpiredWhatsAppData", () => {
  it("purges terminal rows per branch and returns preserved counts", async () => {
    const result = await purgeExpiredWhatsAppData(now);

    expect(result).toEqual({
      branches: 2,
      messages: 5,
      outbox: 5,
      webhookEvents: 7,
      reminders: 11,
    });
    expect(prisma.whatsAppMessage.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.whatsAppOutbox.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.whatsAppReminder.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.whatsAppWebhookEvent.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("uses configured retention days and the default for missing values", async () => {
    await purgeExpiredWhatsAppData(now);

    const firstWhere = vi.mocked(prisma.whatsAppMessage.deleteMany).mock.calls[0]![0]!.where as {
      branchId: string;
      createdAt: { lt: Date };
      status: { in: string[] };
    };
    const secondWhere = vi.mocked(prisma.whatsAppMessage.deleteMany).mock.calls[1]![0]!.where as {
      branchId: string;
      createdAt: { lt: Date };
      status: { in: string[] };
    };
    expect(firstWhere.createdAt.lt).toEqual(new Date(now.getTime() - 10 * 86400000));
    expect(secondWhere.createdAt.lt).toEqual(new Date(now.getTime() - 180 * 86400000));
    expect(firstWhere.status.in).toContain("delivered");
    expect(secondWhere.branchId).toBe("branch-b");
  });
});
