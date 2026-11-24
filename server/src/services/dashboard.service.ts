import { prisma, Prisma } from "../db/prisma";
import { requireBranchId } from "../utils/scope";
import {
  istDateKey,
  istStartOfDay,
  istEndOfDay,
  shiftDateKey,
  istStartOfMonth,
  istEndOfMonth,
  istDayOfWeek,
} from "../utils/date";

const RECENT_PREVIEW_LIMIT = 10;
const DASHBOARD_PREVIEW_LIMIT = 20;
const OPERATIONS_PREVIEW_LIMIT = 100;

const orderSelect = {
  id: true,
  branchId: true,
  customerId: true,
  visitId: true,
  frame: true,
  frameBrand: true,
  frameModel: true,
  frameColor: true,
  frameSize: true,
  framePrice: true,
  lens: true,
  lensBrand: true,
  lensType: true,
  lensIndex: true,
  lensPrice: true,
  coating: true,
  coatingPrice: true,
  accessories: true,
  quantity: true,
  forwardedCount: true,
  deliveryDate: true,
  actualDeliveryDate: true,
  status: true,
  labAssigned: true,
  labExpectedDate: true,
  labRemarks: true,
  reviewed: true,
  classification: true,
  rightLensStatus: true,
  leftLensStatus: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true, mobile: true } },
} as const;

const prescriptionSelect = {
  id: true,
  branchId: true,
  customerId: true,
  visitId: true,
  rightEye: true,
  leftEye: true,
  pd: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DayCountRow = { _id: string; count: number };
type DayTotalRow = { _id: string; total: number };
type DailySalesRow = DayTotalRow & { count: number };
type PaymentModeGroup = {
  paymentMode: string;
  _sum: { amount: number | null };
  _count: number;
};

function getDayRange(date?: Date): { start: Date; end: Date } {
  const d = date || new Date();
  const key = istDateKey(d);
  return { start: istStartOfDay(key), end: istEndOfDay(key) };
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const todayKey = istDateKey(now);
  const startKey = shiftDateKey(todayKey, -istDayOfWeek(now));
  return { start: istStartOfDay(startKey), end: istEndOfDay(todayKey) };
}

function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const todayKey = istDateKey(now);
  return { start: istStartOfMonth(todayKey), end: istEndOfDay(todayKey) };
}

function calcTrend(
  current: number,
  previous: number
): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0)
    return { value: current > 0 ? 100 : 0, direction: current > 0 ? "up" : "flat" };
  const pct = ((current - previous) / previous) * 100;
  return {
    value: Math.round(Math.abs(pct)),
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

function translatePaymentMode(mode: string): string {
  const map: Record<string, string> = {
    नकद: "Cash",
    कार्ड: "Card",
    बैंक: "Bank Transfer",
    बीमा: "Insurance",
  };
  return map[mode] || mode;
}

function dailySalesRows(branchId: string, start: Date, end: Date) {
  return prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
    SELECT to_char((("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS "_id",
           COALESCE(SUM("totalAmount"), 0) AS "total",
           COUNT(*)::int AS "count"
    FROM "bills"
    WHERE "branchId" = ${branchId}
      AND "created_at" >= ${start}
      AND "created_at" <= ${end}
      AND "status" = 'Active'
    GROUP BY 1
    ORDER BY 1 ASC
  `);
}

function dailyCollectionRows(branchId: string, start: Date, end: Date) {
  return prisma.$queryRaw<DayTotalRow[]>(Prisma.sql`
    SELECT to_char((("paymentDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS "_id",
           COALESCE(SUM("amount"), 0) AS "total"
    FROM "payments"
    WHERE "branchId" = ${branchId}
      AND "paymentDate" >= ${start}
      AND "paymentDate" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
}

function weeklyOrderTrendRows(branchId: string, start: Date, end: Date) {
  return prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
    SELECT to_char((("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS "_id",
           COUNT(*)::int AS "count"
    FROM "orders"
    WHERE "branchId" = ${branchId}
      AND "created_at" >= ${start}
      AND "created_at" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
}

function paymentModeSplitRows(branchId: string, start: Date, end: Date) {
  return prisma.payment.groupBy({
    by: ["paymentMode"],
    where: { branchId, paymentDate: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: true,
  });
}

function mapPaymentModeSplit(rows: PaymentModeGroup[]) {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const mode = translatePaymentMode(row.paymentMode);
    const existing = grouped.get(mode) || { total: 0, count: 0 };
    existing.total += row._sum.amount || 0;
    existing.count += row._count;
    grouped.set(mode, existing);
  }
  return Array.from(grouped.entries())
    .map(([mode, data]) => ({ mode, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total);
}

export async function getStats() {
  const branchId = requireBranchId();
  const { start: dayStart, end: dayEnd } = getDayRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  const thirtyDaysAgoKey = shiftDateKey(istDateKey(dayStart), -29);
  const thirtyDaysAgo = istStartOfDay(thirtyDaysAgoKey);

  const prevMonthStart = istStartOfMonth(shiftDateKey(istDateKey(monthStart), -1));
  const prevMonthEnd = istEndOfMonth(istDateKey(monthStart));

  const [
    customerCount,
    orderCount,
    billCount,
    paymentCount,
    inventoryCount,
    deliveryCount,
    visitCount,
    todaySalesResult,
    todayCollectionResult,
    weekSalesResult,
    monthSalesResult,
    readyDeliveries,
    newCustomersToday,
    lowStockItems,
    pendingBills,
    pendingBillCount,
    recentOrders,
    todayDeliveries,
    pendingDeliveries,
    monthSalesPrevResult,
    dailySalesAgg,
    paymentsForModeSplit,
    orderStatusCounts,
    todayDeliveredOrders,
    todayOrderCount,
    weekOrderCount,
    monthOrderCount,
    todayBillCount,
    weekBillCount,
    monthBillCount,
    incompleteOrders,
    weeklyOrderTrend,
    dailyCollectionAgg,
    inventoryForCategories,
    paymentsForTodayModeSplit,
  ] = await Promise.all([
    prisma.customer.count({ where: { branchId } }),
    prisma.order.count({ where: { branchId } }),
    prisma.bill.count({ where: { branchId, status: "Active" } }),
    prisma.payment.count({ where: { branchId } }),
    prisma.inventory.count({ where: { branchId } }),
    prisma.delivery.count({ where: { branchId } }),
    prisma.visit.count({ where: { branchId } }),
    prisma.bill.aggregate({
      where: { branchId, createdAt: { gte: dayStart, lte: dayEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { branchId, paymentDate: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    }),
    prisma.bill.aggregate({
      where: { branchId, createdAt: { gte: weekStart, lte: weekEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.bill.aggregate({
      where: { branchId, createdAt: { gte: monthStart, lte: monthEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.delivery.count({ where: { branchId, status: "Ready" } }),
    prisma.customer.count({ where: { branchId, createdAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.inventory.count({ where: { branchId, quantity: { lte: 5 } } }),
    prisma.bill.findMany({
      where: { branchId, status: "Active", pendingAmount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_PREVIEW_LIMIT,
      select: {
        id: true,
        pendingAmount: true,
        customer: { select: { name: true, mobile: true } },
      },
    }),
    prisma.bill.count({
      where: { branchId, status: "Active", pendingAmount: { gt: 0 } },
    }),
    prisma.order.findMany({
      where: { branchId, createdAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { createdAt: "desc" },
      take: RECENT_PREVIEW_LIMIT,
      select: orderSelect,
    }),
    prisma.order.findMany({
      where: { branchId, status: "Ready", deliveryDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: RECENT_PREVIEW_LIMIT,
      select: orderSelect,
    }),
    prisma.order.findMany({
      where: { branchId, status: { notIn: ["Delivered", "Cancelled"] } },
      orderBy: { createdAt: "desc" },
      take: OPERATIONS_PREVIEW_LIMIT,
      select: orderSelect,
    }),
    prisma.bill.aggregate({
      where: { branchId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    dailySalesRows(branchId, thirtyDaysAgo, dayEnd),
    paymentModeSplitRows(branchId, monthStart, monthEnd),
    prisma.order.groupBy({ by: ["status"], where: { branchId }, _count: true }),
    prisma.order.findMany({
      where: { branchId, status: "Delivered", actualDeliveryDate: { gte: dayStart, lte: dayEnd } },
      orderBy: { actualDeliveryDate: "desc" },
      take: DASHBOARD_PREVIEW_LIMIT,
      select: orderSelect,
    }),
    prisma.order.count({ where: { branchId, createdAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.order.count({ where: { branchId, createdAt: { gte: weekStart, lte: weekEnd } } }),
    prisma.order.count({ where: { branchId, createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.bill.count({
      where: { branchId, createdAt: { gte: dayStart, lte: dayEnd }, status: "Active" },
    }),
    prisma.bill.count({
      where: { branchId, createdAt: { gte: weekStart, lte: weekEnd }, status: "Active" },
    }),
    prisma.bill.count({
      where: { branchId, createdAt: { gte: monthStart, lte: monthEnd }, status: "Active" },
    }),
    prisma.order.findMany({
      where: { branchId, status: "Draft" },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_PREVIEW_LIMIT,
      select: orderSelect,
    }),
    weeklyOrderTrendRows(branchId, thirtyDaysAgo, dayEnd),
    dailyCollectionRows(branchId, thirtyDaysAgo, dayEnd),
    prisma.inventory.groupBy({
      by: ["category"],
      where: { branchId },
      _count: true,
    }),
    paymentModeSplitRows(branchId, dayStart, dayEnd),
  ]);

  const displayedVisitIds = Array.from(
    new Set(
      [...recentOrders, ...incompleteOrders]
        .map((order) => order.visitId)
        .filter((visitId): visitId is string => Boolean(visitId))
    )
  );
  const displayedPrescriptions =
    displayedVisitIds.length > 0
      ? await prisma.prescription.findMany({
          where: { branchId, visitId: { in: displayedVisitIds } },
          select: prescriptionSelect,
          take: displayedVisitIds.length,
        })
      : [];
  const rxMap = new Map(displayedPrescriptions.map((p) => [p.visitId!, p]));
  const recentOrdersWithRx = recentOrders.map((order) => ({
    ...order,
    prescription: order.visitId ? rxMap.get(order.visitId) || null : null,
  }));
  const incompleteOrdersWithRx = incompleteOrders.map((order) => ({
    ...order,
    prescription: order.visitId ? rxMap.get(order.visitId) || null : null,
  }));

  const todaySales = todaySalesResult._sum?.totalAmount || 0;
  const todayCollection = todayCollectionResult._sum?.amount || 0;
  const weekSales = weekSalesResult._sum?.totalAmount || 0;
  const monthSales = monthSalesResult._sum?.totalAmount || 0;
  const prevMonthSales = monthSalesPrevResult._sum?.totalAmount || 0;

  const salesTrendObj = calcTrend(monthSales, prevMonthSales);
  const salesTrend =
    salesTrendObj.direction === "flat"
      ? "0"
      : `${salesTrendObj.direction === "up" ? "" : "-"}${salesTrendObj.value}`;

  const mappedOrderStatusCounts = orderStatusCounts.map((d: any) => ({
    status: d.status,
    count: d._count,
  }));

  const categoryBreakdown = (
    inventoryForCategories as unknown as Array<{ category: string; _count: number }>
  )
    .map((row) => ({ category: row.category, count: row._count, totalValue: 0 }))
    .sort((a, b) => b.count - a.count);

  const mappedDailySales = dailySalesAgg
    .slice()
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((d) => ({ date: d._id, total: d.total }));
  const mappedDailyCollections = dailyCollectionAgg
    .slice()
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((d) => ({ date: d._id, total: d.total }));
  const mappedWeeklyOrderTrend = weeklyOrderTrend
    .slice()
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((d) => ({ date: d._id, count: d.count }));
  const mappedCategoryBreakdown = categoryBreakdown.map(
    (d: { category: string; count: number; totalValue: number }) => ({
      category: d.category,
      count: d.count,
      totalValue: d.totalValue,
    })
  );

  return {
    counts: {
      customers: customerCount,
      orders: orderCount,
      bills: billCount,
      payments: paymentCount,
      inventory: inventoryCount,
      deliveries: deliveryCount,
      visits: visitCount,
    },
    todaySales,
    todayCollection,
    weekSales,
    monthSales,
    readyDeliveries,
    newCustomersToday,
    lowStock: lowStockItems,
    pendingPayments: pendingBillCount,
    recentOrders: recentOrdersWithRx,
    todayDeliveries,
    pendingDeliveries,
    pendingBills,
    incompleteOrders: incompleteOrdersWithRx,
    dailySales: mappedDailySales,
    paymentModeSplit: mapPaymentModeSplit(paymentsForModeSplit),
    orderStatusCounts: mappedOrderStatusCounts,
    salesTrend,
    todayDeliveredOrders,
    todayOrders: todayOrderCount,
    weekOrders: weekOrderCount,
    monthOrders: monthOrderCount,
    todayBills: todayBillCount,
    weekBills: weekBillCount,
    monthBills: monthBillCount,
    dailyCollections: mappedDailyCollections,
    weeklyOrderTrend: mappedWeeklyOrderTrend,
    categoryBreakdown: mappedCategoryBreakdown,
    todayPaymentModeSplit: mapPaymentModeSplit(paymentsForTodayModeSplit),
  };
}
