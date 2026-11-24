import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, Prisma } from "../db/prisma";
import { ctx } from "../utils/requestContext";
import { getStats } from "./dashboard.service";

vi.mock("../db/prisma", () => ({
  prisma: {
    customer: { count: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    bill: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    payment: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    inventory: { count: vi.fn(), groupBy: vi.fn() },
    delivery: { count: vi.fn() },
    visit: { count: vi.fn() },
    prescription: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  Prisma: {
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  },
}));

const branchId = "branch-1";
const fakeNow = new Date("2026-11-24T06:00:00.000Z");

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-recent",
    branchId,
    customerId: "cust-1",
    visitId: "visit-recent",
    frame: "Frame A",
    frameBrand: "Brand",
    frameModel: "Model",
    frameColor: "Black",
    frameSize: "52",
    framePrice: 1000,
    lens: "Lens A",
    lensBrand: "Brand",
    lensType: "progressive",
    lensIndex: "1.5",
    lensPrice: 2000,
    coating: "Blue",
    coatingPrice: 300,
    accessories: [],
    quantity: 1,
    forwardedCount: 0,
    deliveryDate: new Date("2026-11-24T10:00:00.000Z"),
    actualDeliveryDate: null,
    status: "Ordered",
    labAssigned: null,
    labExpectedDate: null,
    labRemarks: null,
    reviewed: false,
    classification: "pending",
    rightLensStatus: "pending",
    leftLensStatus: "pending",
    createdAt: new Date("2026-11-24T05:00:00.000Z"),
    updatedAt: new Date("2026-11-24T05:00:00.000Z"),
    customer: { name: "Customer One", mobile: "9876543210" },
    ...overrides,
  };
}

function makePrescription(visitId: string) {
  return {
    id: `rx-${visitId}`,
    branchId,
    customerId: "cust-1",
    visitId,
    rightEye: { sph: "-1.00" },
    leftEye: { sph: "-1.25" },
    pd: "62",
    notes: null,
    createdAt: new Date("2026-11-24T05:00:00.000Z"),
    updatedAt: new Date("2026-11-24T05:00:00.000Z"),
  };
}

function rawText(query: unknown): string {
  return (query as { strings: readonly string[] }).strings.join(" ");
}

function rawValues(query: unknown): unknown[] {
  return (query as { values: unknown[] }).values;
}

async function runStats() {
  return ctx.run({ branchId }, () => getStats());
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(fakeNow);
  (Prisma.sql as any).mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }));

  vi.mocked(prisma.customer.count).mockResolvedValue(10 as never);
  vi.mocked(prisma.order.count).mockResolvedValue(20 as never);
  vi.mocked(prisma.delivery.count).mockResolvedValue(3 as never);
  vi.mocked(prisma.visit.count).mockResolvedValue(8 as never);
  vi.mocked(prisma.inventory.count).mockResolvedValue(50 as never);
  vi.mocked(prisma.payment.count).mockResolvedValue(12 as never);
  vi.mocked(prisma.bill.count).mockImplementation(
    (args: any) => Promise.resolve(args.where.pendingAmount ? 17 : 6) as never
  );
  vi.mocked(prisma.bill.aggregate).mockResolvedValue({ _sum: { totalAmount: 1000 } } as never);
  vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 250 } } as never);

  vi.mocked(prisma.bill.findMany).mockResolvedValue([
    { id: "bill-1", pendingAmount: 500, customer: { name: "A", mobile: "1" } },
    { id: "bill-2", pendingAmount: 300, customer: { name: "B", mobile: "2" } },
  ] as never);

  (prisma.order.findMany as any).mockImplementation((args: any) => {
    if (args.where.status === "Delivered") {
      return Promise.resolve([makeOrder({ id: "order-delivered", visitId: null })] as never);
    }
    if (args.where.status === "Draft") {
      return Promise.resolve([makeOrder({ id: "order-draft", visitId: "visit-draft" })] as never);
    }
    if (args.where.deliveryDate) {
      return Promise.resolve([makeOrder({ id: "order-ready" })] as never);
    }
    if (args.where.status?.notIn) {
      return Promise.resolve([makeOrder({ id: "order-pending" })] as never);
    }
    return Promise.resolve([makeOrder()] as never);
  });

  vi.mocked(prisma.prescription.findMany).mockResolvedValue([
    makePrescription("visit-recent"),
    makePrescription("visit-draft"),
  ] as never);

  vi.mocked(prisma.order.groupBy).mockResolvedValue([
    { status: "Draft", _count: 3 },
    { status: "Delivered", _count: 7 },
  ] as never);
  vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
    { category: "Frames", _count: 8 },
    { category: "Lenses", _count: 5 },
  ] as never);

  vi.mocked(prisma.payment.groupBy)
    .mockResolvedValueOnce([
      { paymentMode: "नकद", _sum: { amount: 100 }, _count: 2 },
      { paymentMode: "Cash", _sum: { amount: 50 }, _count: 1 },
      { paymentMode: "बैंक", _sum: { amount: 300 }, _count: 3 },
    ] as never)
    .mockResolvedValueOnce([{ paymentMode: "कार्ड", _sum: { amount: 75 }, _count: 1 }] as never);

  (prisma.$queryRaw as any).mockImplementation((query: unknown) => {
    const text = rawText(query);
    if (text.includes('FROM "bills"')) {
      return Promise.resolve([
        { _id: "2026-11-23", total: 200, count: 2 },
        { _id: "2026-11-24", total: 50, count: 1 },
      ]);
    }
    if (text.includes('FROM "orders"')) {
      return Promise.resolve([{ _id: "2026-11-24", count: 5 }]);
    }
    return Promise.resolve([
      { _id: "2026-11-23", total: 120 },
      { _id: "2026-11-24", total: 30 },
    ]);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getStats — response contract", () => {
  it("preserves response keys and array object shapes", async () => {
    const result = await runStats();

    expect(Object.keys(result)).toEqual([
      "counts",
      "todaySales",
      "todayCollection",
      "weekSales",
      "monthSales",
      "readyDeliveries",
      "newCustomersToday",
      "lowStock",
      "pendingPayments",
      "recentOrders",
      "todayDeliveries",
      "pendingDeliveries",
      "pendingBills",
      "incompleteOrders",
      "dailySales",
      "paymentModeSplit",
      "orderStatusCounts",
      "salesTrend",
      "todayDeliveredOrders",
      "todayOrders",
      "weekOrders",
      "monthOrders",
      "todayBills",
      "weekBills",
      "monthBills",
      "dailyCollections",
      "weeklyOrderTrend",
      "categoryBreakdown",
      "todayPaymentModeSplit",
    ]);
    expect(Object.keys(result.counts)).toEqual([
      "customers",
      "orders",
      "bills",
      "payments",
      "inventory",
      "deliveries",
      "visits",
    ]);
    expect(result.pendingBills[0]).toEqual({
      id: "bill-1",
      pendingAmount: 500,
      customer: { name: "A", mobile: "1" },
    });
    expect(Object.keys(result.recentOrders[0])).toEqual([
      ...Object.keys(makeOrder()),
      "prescription",
    ]);
    expect(Object.keys(result.todayDeliveries[0])).toEqual(Object.keys(makeOrder()));
    expect(Object.keys(result.pendingDeliveries[0])).toEqual(Object.keys(makeOrder()));
    expect(Object.keys(result.todayDeliveredOrders[0])).toEqual(Object.keys(makeOrder()));
    expect(Object.keys(result.incompleteOrders[0])).toEqual([
      ...Object.keys(makeOrder()),
      "prescription",
    ]);
    expect(result.recentOrders[0].prescription).toEqual(makePrescription("visit-recent"));
    expect(result.incompleteOrders[0].prescription).toEqual(makePrescription("visit-draft"));
    expect(result.todayDeliveredOrders[0]).not.toHaveProperty("prescription");

    expect(result.dailySales).toEqual([
      { date: "2026-11-23", total: 200 },
      { date: "2026-11-24", total: 50 },
    ]);
    expect(result.dailyCollections).toEqual([
      { date: "2026-11-23", total: 120 },
      { date: "2026-11-24", total: 30 },
    ]);
    expect(result.weeklyOrderTrend).toEqual([{ date: "2026-11-24", count: 5 }]);
    expect(result.orderStatusCounts).toEqual([
      { status: "Draft", count: 3 },
      { status: "Delivered", count: 7 },
    ]);
    expect(result.categoryBreakdown).toEqual([
      { category: "Frames", count: 8, totalValue: 0 },
      { category: "Lenses", count: 5, totalValue: 0 },
    ]);
    expect(typeof result.todaySales).toBe("number");
    expect(typeof result.todayCollection).toBe("number");
    expect(typeof result.pendingPayments).toBe("number");
  });

  it("uses a separate count for pendingPayments when the preview is capped", async () => {
    const result = await runStats();
    const billListArgs = (prisma.bill.findMany as any).mock.calls[0][0];

    expect(result.pendingBills).toHaveLength(2);
    expect(result.pendingPayments).toBe(17);
    expect(billListArgs.take).toBe(20);
    expect(billListArgs.select).toEqual({
      id: true,
      pendingAmount: true,
      customer: { select: { name: true, mobile: true } },
    });
  });

  it("merges translated payment modes while preserving descending total order", async () => {
    const result = await runStats();

    expect(result.paymentModeSplit).toEqual([
      { mode: "Bank Transfer", total: 300, count: 3 },
      { mode: "Cash", total: 150, count: 3 },
    ]);
    expect(result.todayPaymentModeSplit).toEqual([{ mode: "Card", total: 75, count: 1 }]);
  });
});

describe("getStats — query bounds and projections", () => {
  it("bounds and projects every row-returning preview list", async () => {
    await runStats();

    const listArgs = [
      ...(prisma.bill.findMany as any).mock.calls.map((call: any[]) => call[0]),
      ...(prisma.order.findMany as any).mock.calls.map((call: any[]) => call[0]),
      ...(prisma.prescription.findMany as any).mock.calls.map((call: any[]) => call[0]),
    ];

    expect(listArgs).toHaveLength(7);
    for (const args of listArgs) {
      expect(args.where.branchId).toBe(branchId);
      expect(args.take).toBeGreaterThan(0);
      expect(Number.isInteger(args.take)).toBe(true);
      expect(args.select).toBeTypeOf("object");
      expect(args).not.toHaveProperty("include");
    }
  });

  it("fetches prescriptions only for the bounded displayed visit IDs", async () => {
    await runStats();

    expect(prisma.prescription.findMany).toHaveBeenCalledTimes(1);
    const args = (prisma.prescription.findMany as any).mock.calls[0][0];
    expect(args.where.visitId.in.sort()).toEqual(["visit-draft", "visit-recent"]);
    expect(args.take).toBe(2);
    expect(args.select.visitId).toBe(true);
  });

  it("keeps branch and date predicates on grouped payment queries", async () => {
    await runStats();

    const calls = (prisma.payment.groupBy as any).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [args] of calls) {
      expect(args.where.branchId).toBe(branchId);
      expect(args.where.paymentDate.gte).toBeInstanceOf(Date);
      expect(args.where.paymentDate.lte).toBeInstanceOf(Date);
      expect(args._sum.amount).toBe(true);
    }
  });

  it("uses parameterized IST aggregation for daily charts", async () => {
    await runStats();

    const calls = (prisma.$queryRaw as any).mock.calls;
    expect(calls).toHaveLength(3);
    for (const [query] of calls) {
      const text = rawText(query);
      expect(text).toContain('"branchId" =');
      expect(text).toContain("Asia/Kolkata");
      expect(text).toContain(">=");
      expect(text).toContain("<=");
      expect(text).not.toContain(branchId);
      expect(rawValues(query)).toContain(branchId);
    }
    expect(vi.mocked(Prisma.sql)).toHaveBeenCalledTimes(3);
  });
});
