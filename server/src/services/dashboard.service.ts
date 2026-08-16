import { prisma } from "../db/prisma";
import {
  istDateKey,
  istStartOfDay,
  istEndOfDay,
  shiftDateKey,
  istStartOfMonth,
  istEndOfMonth,
  istDayOfWeek,
} from "../utils/date";

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
    "नकद": "Cash",
    "कार्ड": "Card",
    "बैंक": "Bank Transfer",
    "बीमा": "Insurance",
  };
  return map[mode] || mode;
}

export async function getStats() {
  const { start: dayStart, end: dayEnd } = getDayRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  const prevDayKey = shiftDateKey(istDateKey(dayStart), -1);
  const { start: prevDayStart, end: prevDayEnd } = getDayRange(istStartOfDay(prevDayKey));

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
    recentCustomers,
    recentOrders,
    todayDeliveries,
    pendingDeliveries,
    _prevDaySalesResult,
    monthSalesPrevResult,
    prevDayCollectionResult,
    billsForDailySales,
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
    ordersForDailyCounts,
    paymentsForDailyCounts,
    inventoryForCategories,
    paymentsForTodayModeSplit,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.bill.count({ where: { status: "Active" } }),
    prisma.payment.count(),
    prisma.inventory.count(),
    prisma.delivery.count(),
    prisma.visit.count(),
    prisma.bill.aggregate({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    }),
    prisma.bill.aggregate({
      where: { createdAt: { gte: weekStart, lte: weekEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.bill.aggregate({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.delivery.count({ where: { status: "Ready" } }),
    prisma.customer.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.inventory.count({ where: { quantity: { lte: 5 } } }),
    prisma.bill.findMany({
      where: { status: "Active", pendingAmount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { name: true, mobile: true, totalSpent: true, totalVisits: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.order.findMany({
      where: { status: "Ready", deliveryDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: 10,
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.order.findMany({
      where: { status: { notIn: ["Delivered", "Cancelled"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.bill.aggregate({
      where: { createdAt: { gte: prevDayStart, lte: prevDayEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.bill.aggregate({
      where: { createdAt: { gte: prevMonthStart, lte: prevMonthEnd }, status: "Active" },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: prevDayStart, lte: prevDayEnd } },
      _sum: { amount: true },
    }),
    prisma.bill.findMany({
      where: { createdAt: { gte: thirtyDaysAgo, lte: dayEnd }, status: "Active" },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: monthStart, lte: monthEnd } },
      select: { paymentMode: true, amount: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.findMany({
      where: { status: "Delivered", actualDeliveryDate: { gte: dayStart, lte: dayEnd } },
      orderBy: { actualDeliveryDate: "desc" },
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.order.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.order.count({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.bill.count({ where: { createdAt: { gte: dayStart, lte: dayEnd }, status: "Active" } }),
    prisma.bill.count({ where: { createdAt: { gte: weekStart, lte: weekEnd }, status: "Active" } }),
    prisma.bill.count({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: "Active" } }),
    prisma.order.findMany({
      where: { status: { in: ["Draft", "Ordered", "In Lab"] } },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true, mobile: true } } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo, lte: dayEnd } },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: thirtyDaysAgo, lte: dayEnd } },
      select: { paymentMode: true, amount: true, paymentDate: true },
    }),
    prisma.inventory.findMany({
      select: { category: true, sellingPrice: true, quantity: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: dayStart, lte: dayEnd } },
      select: { paymentMode: true, amount: true },
    }),
  ]);

  const recentOrderVisitIds = recentOrders
    .map((o: any) => o.visitId)
    .filter(Boolean) as string[];
  const recentPrescriptions =
    recentOrderVisitIds.length > 0
      ? await prisma.prescription.findMany({ where: { visitId: { in: recentOrderVisitIds } } })
      : [];
  const rxMap = new Map(recentPrescriptions.map((p) => [p.visitId!, p]));
  const recentOrdersWithRx = recentOrders.map((o: any) => {
    return { ...o, prescription: o.visitId ? rxMap.get(o.visitId) || null : null };
  });

  const incompleteOrderVisitIds = incompleteOrders
    .map((o: any) => o.visitId)
    .filter(Boolean) as string[];
  const allVisitIds = [...new Set([...recentOrderVisitIds, ...incompleteOrderVisitIds])];
  const allPrescriptions =
    allVisitIds.length > 0
      ? await prisma.prescription.findMany({ where: { visitId: { in: allVisitIds } } })
      : [];
  const fullRxMap = new Map(allPrescriptions.map((p) => [p.visitId!, p]));
  const incompleteOrdersWithRx = incompleteOrders.map((o: any) => {
    return { ...o, prescription: o.visitId ? fullRxMap.get(o.visitId) || null : null };
  });

  const todaySales = todaySalesResult._sum?.totalAmount || 0;
  const todayCollection = todayCollectionResult._sum?.amount || 0;
  const weekSales = weekSalesResult._sum?.totalAmount || 0;
  const monthSales = monthSalesResult._sum?.totalAmount || 0;
  const prevMonthSales = monthSalesPrevResult._sum?.totalAmount || 0;
  const prevDayCollection = prevDayCollectionResult._sum?.amount || 0;

  const salesTrendObj = calcTrend(monthSales, prevMonthSales);
  const salesTrend =
    salesTrendObj.direction === "flat"
      ? "0"
      : `${salesTrendObj.direction === "up" ? "" : "-"}${salesTrendObj.value}`;

  const salesByDateGrouped = new Map<string, { total: number; count: number }>();
  for (const bill of billsForDailySales) {
    const key = istDateKey(bill.createdAt);
    const existing = salesByDateGrouped.get(key) || { total: 0, count: 0 };
    existing.total += bill.totalAmount;
    existing.count += 1;
    salesByDateGrouped.set(key, existing);
  }
  const dailySalesAgg = Array.from(salesByDateGrouped.entries())
    .map(([id, data]) => ({ _id: id, ...data }))
    .sort((a, b) => a._id.localeCompare(b._id));

  function groupPaymentsByMode(
    payments: Array<{ paymentMode: string; amount: number }>
  ) {
    const grouped = new Map<string, { total: number; count: number }>();
    for (const p of payments) {
      const mode = translatePaymentMode(p.paymentMode);
      const existing = grouped.get(mode) || { total: 0, count: 0 };
      existing.total += p.amount;
      existing.count += 1;
      grouped.set(mode, existing);
    }
    return Array.from(grouped.entries())
      .map(([id, data]) => ({ _id: id, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  const paymentModeSplit = groupPaymentsByMode(paymentsForModeSplit);

  const mappedOrderStatusCounts = orderStatusCounts.map((d: any) => ({
    status: d.status,
    count: d._count,
  }));

  const todayPaymentModeSplit = groupPaymentsByMode(paymentsForTodayModeSplit);

  const ordersByDateGrouped = new Map<string, number>();
  for (const order of ordersForDailyCounts) {
    const key = istDateKey(order.createdAt);
    ordersByDateGrouped.set(key, (ordersByDateGrouped.get(key) || 0) + 1);
  }
  const orderCounts = Array.from(ordersByDateGrouped.entries())
    .map(([id, count]) => ({ _id: id, count }))
    .sort((a, b) => a._id.localeCompare(b._id));

  const weeklyOrderTrend = orderCounts;

  const paymentsByDateGrouped = new Map<string, { count: number; total: number }>();
  for (const payment of paymentsForDailyCounts) {
    const key = istDateKey(payment.paymentDate);
    const existing = paymentsByDateGrouped.get(key) || { count: 0, total: 0 };
    existing.count += 1;
    existing.total += payment.amount;
    paymentsByDateGrouped.set(key, existing);
  }
  const paymentCounts = Array.from(paymentsByDateGrouped.entries())
    .map(([id, data]) => ({ _id: id, ...data }))
    .sort((a, b) => a._id.localeCompare(b._id));

  const dailyCollectionByDate = new Map<string, number>();
  for (const payment of paymentsForDailyCounts) {
    const key = istDateKey(payment.paymentDate);
    dailyCollectionByDate.set(key, (dailyCollectionByDate.get(key) || 0) + payment.amount);
  }
  const dailyCollectionAgg = Array.from(dailyCollectionByDate.entries())
    .map(([id, total]) => ({ _id: id, total }))
    .sort((a, b) => a._id.localeCompare(b._id));

  const categoryGrouped = new Map<string, { count: number; totalValue: number }>();
  for (const item of inventoryForCategories) {
    const existing = categoryGrouped.get(item.category) || { count: 0, totalValue: 0 };
    existing.count += 1;
    existing.totalValue += item.sellingPrice * item.quantity;
    categoryGrouped.set(item.category, existing);
  }
  const categoryBreakdown = Array.from(categoryGrouped.entries())
    .map(([id, data]) => ({ _id: id, ...data }))
    .sort((a, b) => b.count - a.count);

  const mappedDailySales = dailySalesAgg.map(
    (d: { _id: string; total: number; count: number }) => ({ date: d._id, total: d.total })
  );
  const mappedDailyCollections = dailyCollectionAgg.map((d: { _id: string; total: number }) => ({
    date: d._id,
    total: d.total,
  }));
  const mappedWeeklyOrderTrend = weeklyOrderTrend.map((d: { _id: string; count: number }) => ({
    date: d._id,
    count: d.count,
  }));
  const mappedCategoryBreakdown = categoryBreakdown.map(
    (d: { _id: string; count: number; totalValue: number }) => ({
      category: d._id,
      count: d.count,
      totalValue: d.totalValue,
    })
  );

  const mappedPaymentModeSplit = paymentModeSplit.map(
    (d: { _id: string; total: number; count: number }) => ({
      mode: d._id,
      total: d.total,
      count: d.count,
    })
  );
  const mappedTodayPaymentModeSplit = todayPaymentModeSplit.map(
    (d: { _id: string; total: number; count: number }) => ({
      mode: d._id,
      total: d.total,
      count: d.count,
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
    pendingPayments: pendingBills.length,
    recentCustomers,
    recentOrders: recentOrdersWithRx,
    todayDeliveries,
    pendingDeliveries,
    pendingBills,
    incompleteOrders: incompleteOrdersWithRx,
    orderCounts,
    paymentCounts,
    dailySales: mappedDailySales,
    paymentModeSplit: mappedPaymentModeSplit,
    orderStatusCounts: mappedOrderStatusCounts,
    salesTrend,
    collectionTrend: calcTrend(todayCollection, prevDayCollection),
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
    todayPaymentModeSplit: mappedTodayPaymentModeSplit,
  };
}
