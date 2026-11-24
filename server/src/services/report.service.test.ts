import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, Prisma } from "../db/prisma";
import { ctx } from "../utils/requestContext";
import { istStartOfDay } from "../utils/date";
import { getDeliveryReport, getInventoryReport, getMonthlyReport } from "./report.service";

vi.mock("../db/prisma", () => ({
  prisma: {
    bill: { aggregate: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn() },
    customer: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    inventory: { findMany: vi.fn() },
    delivery: { groupBy: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  Prisma: {
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  },
}));

const branchId = "branch-1";
const fakeNow = new Date("2026-02-28T18:30:00.000Z");
const dayMs = 24 * 60 * 60 * 1000;

function isSql(value: unknown): value is { strings: readonly string[]; values: unknown[] } {
  return typeof value === "object" && value !== null && "strings" in value && "values" in value;
}

function rawText(query: unknown): string {
  const sql = query as { strings: readonly string[]; values: unknown[] };
  return [sql.strings.join(" "), ...sql.values.filter(isSql).map(rawText)].join(" ");
}

function rawValues(query: unknown): unknown[] {
  const sql = query as { strings: readonly string[]; values: unknown[] };
  return sql.values.flatMap((value) => (isSql(value) ? rawValues(value) : [value]));
}

function hasDate(values: unknown[], expected: Date): boolean {
  return values.some((value) => value instanceof Date && value.getTime() === expected.getTime());
}

function makeInventory(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    branchId,
    sku: "SKU-1",
    category: "Frames",
    inventoryType: "spectacles",
    brand: "Brand",
    model: "Model",
    color: "Black",
    size: "52",
    gender: "",
    supplier: "Supplier",
    quantity: 2,
    location: "shop",
    purchasePrice: 10,
    sellingPrice: 20,
    description: null,
    lensIndex: null,
    lensCoating: null,
    sphRight: null,
    cylRight: null,
    axisRight: null,
    sphLeft: null,
    cylLeft: null,
    axisLeft: null,
    addPower: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  return ctx.run({ branchId }, fn);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(fakeNow);
  (Prisma.sql as any).mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getMonthlyReport", () => {
  beforeEach(() => {
    (prisma.$queryRaw as any).mockImplementation((query: unknown) => {
      if (rawText(query).includes('FROM "bills"')) {
        return Promise.resolve([
          { _id: "2026-01", revenue: 1000.5, collected: 400, pending: 600.5, count: 2 },
          { _id: "2026-02", revenue: 250, collected: 250, pending: 0, count: 1 },
        ]);
      }
      return Promise.resolve([
        { _id: "2026-01", total: 300, count: 3 },
        { _id: "2026-02", total: 120.25, count: 1 },
      ]);
    });
  });

  it("returns grouped IST monthly rows with the existing response shape", async () => {
    const result = await run(getMonthlyReport);

    expect(result).toEqual({
      monthlyRevenue: [
        { _id: "2026-01", revenue: 1000.5, collected: 400, pending: 600.5, count: 2 },
        { _id: "2026-02", revenue: 250, collected: 250, pending: 0, count: 1 },
      ],
      monthlyCollection: [
        { _id: "2026-01", total: 300, count: 3 },
        { _id: "2026-02", total: 120.25, count: 1 },
      ],
    });
    expect(typeof result.monthlyRevenue[0].revenue).toBe("number");
    expect(typeof result.monthlyRevenue[0].count).toBe("number");
    expect(typeof result.monthlyCollection[0].total).toBe("number");
    expect(prisma.bill.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("uses parameterized IST month conversion and the YTD date bounds", async () => {
    await run(getMonthlyReport);

    const calls = (prisma.$queryRaw as any).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [query] of calls) {
      const text = rawText(query);
      expect(text).toContain('"branchId" =');
      expect(text).toContain("AT TIME ZONE 'UTC'");
      expect(text).toContain("Asia/Kolkata");
      expect(text).toContain("YYYY-MM");
      expect(text).not.toContain(branchId);
      expect(rawValues(query)).toContain(branchId);
      expect(hasDate(rawValues(query), istStartOfDay("2026-01-01"))).toBe(true);
      expect(hasDate(rawValues(query), fakeNow)).toBe(true);
    }
    expect(vi.mocked(Prisma.sql)).toHaveBeenCalledTimes(2);
  });
});

describe("getInventoryReport", () => {
  const lowStock = makeInventory({ id: "inv-low", quantity: 1, sellingPrice: 20 });

  beforeEach(() => {
    (prisma.$queryRaw as any).mockImplementation((query: unknown) => {
      const text = rawText(query);
      if (text.includes('AS "totalItems"')) {
        return Promise.resolve([
          { totalItems: 3, totalQuantity: 15, totalValue: 150, totalPriceSum: 60 },
        ]);
      }
      if (text.includes('GROUP BY "category"')) {
        return Promise.resolve([
          { _id: "Frames", count: 2, totalQuantity: 10, totalValue: 100 },
          { _id: "Lenses", count: 1, totalQuantity: 5, totalValue: 50 },
        ]);
      }
      return Promise.resolve([
        { _id: "shop", count: 2, totalValue: 90 },
        { _id: "warehouse", count: 1, totalValue: 60 },
      ]);
    });
    vi.mocked(prisma.inventory.findMany).mockResolvedValue([lowStock] as never);
  });

  it("returns database aggregates with unchanged overview and grouping shapes", async () => {
    const result = await run(() => getInventoryReport());

    expect(Object.keys(result)).toEqual([
      "overview",
      "categoryBreakdown",
      "lowStockItems",
      "valueByLocation",
    ]);
    expect(result.overview).toEqual({
      totalItems: 3,
      totalQuantity: 15,
      totalValue: 150,
      avgSellingPrice: 20,
    });
    expect(result.categoryBreakdown).toEqual([
      { _id: "Frames", count: 2, totalQuantity: 10, totalValue: 100 },
      { _id: "Lenses", count: 1, totalQuantity: 5, totalValue: 50 },
    ]);
    expect(result.valueByLocation).toEqual([
      { _id: "shop", count: 2, totalValue: 90 },
      { _id: "warehouse", count: 1, totalValue: 60 },
    ]);
    expect(result.lowStockItems).toEqual([lowStock]);
    expect(typeof result.overview.totalQuantity).toBe("number");
    expect(typeof result.categoryBreakdown[0].totalValue).toBe("number");
    expect(prisma.inventory.findMany).toHaveBeenCalledTimes(1);
    const listArgs = (prisma.inventory.findMany as any).mock.calls[0][0];
    expect(listArgs.take).toBe(20);
    expect(listArgs.select.sellingPrice).toBe(true);
  });

  it("parameterizes the optional category filter on every aggregate query", async () => {
    await run(() => getInventoryReport("Frames"));

    const calls = (prisma.$queryRaw as any).mock.calls;
    expect(calls).toHaveLength(3);
    for (const [query] of calls) {
      expect(rawText(query)).toContain('"branchId" =');
      expect(rawText(query)).not.toContain("Frames");
      expect(rawValues(query)).toContain(branchId);
      expect(rawValues(query)).toContain("Frames");
    }
    expect(vi.mocked(Prisma.sql)).toHaveBeenCalledTimes(4);
  });
});

describe("getDeliveryReport", () => {
  const statusCounts = [{ status: "Delivered", _count: 4 }];
  const overdue = [
    { id: "delivery-1", customer: { name: "A", mobile: "1" }, order: { frame: "F" } },
  ];

  beforeEach(() => {
    vi.mocked(prisma.delivery.groupBy).mockResolvedValue(statusCounts as never);
    vi.mocked(prisma.delivery.findMany).mockResolvedValue(overdue as never);
  });

  it("preserves status counts and the bounded overdue detail list", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ totalDiffMs: 3.5 * dayMs, count: 1 }]);

    const result = await run(getDeliveryReport);

    expect(Object.keys(result)).toEqual(["statusCounts", "overdueDeliveries", "avgDeliveryDays"]);
    expect(result.statusCounts).toEqual(statusCounts);
    expect(result.overdueDeliveries).toEqual(overdue);
    expect(result.avgDeliveryDays).toBe(3.5);
    expect(prisma.delivery.findMany).toHaveBeenCalledTimes(1);
    const listArgs = (prisma.delivery.findMany as any).mock.calls[0][0];
    expect(listArgs.take).toBe(20);
    expect(listArgs.include.customer.select.name).toBe(true);
    expect(listArgs.include.order.select.status).toBe(true);
  });

  it("uses one parameterized aggregate for the signed duration mean", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ totalDiffMs: 0, count: 0 }]);

    await run(getDeliveryReport);

    const calls = (prisma.$queryRaw as any).mock.calls;
    expect(calls).toHaveLength(1);
    const text = rawText(calls[0][0]);
    expect(text).toContain('"branchId" =');
    expect(text).toContain('"actualDeliveryDate" - "expectedDeliveryDate"');
    expect(text).toContain("COUNT(*)::int");
    expect(text).not.toContain(branchId);
    expect(rawValues(calls[0][0])).toContain(branchId);
  });

  it("preserves negative and zero one-decimal rounding semantics", async () => {
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ totalDiffMs: -0.5 * dayMs, count: 1 }])
      .mockResolvedValueOnce([{ totalDiffMs: 0, count: 0 }]);

    const negative = await run(getDeliveryReport);
    const zero = await run(getDeliveryReport);

    expect(negative.avgDeliveryDays).toBe(-0.5);
    expect(zero.avgDeliveryDays).toBe(0);
    expect(typeof negative.avgDeliveryDays).toBe("number");
    expect(typeof zero.avgDeliveryDays).toBe("number");
  });
});
