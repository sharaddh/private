import { prisma } from "../db/prisma";
import { istStartOfDay, istEndOfDay, istStartOfToday } from "../utils/date";

export async function getRevenueReport(start?: string, end?: string) {
  const match: Record<string, unknown> = {};
  const payMatch: Record<string, unknown> = {};

  if (start || end) {
    const dateFilter: Record<string, Date> = {};
    if (start) dateFilter.gte = istStartOfDay(start);
    if (end) dateFilter.lte = istEndOfDay(end);
    match.createdAt = dateFilter;
    payMatch.paymentDate = { ...dateFilter };
  }

  const [billAgg, paymentAgg] = await Promise.all([
    prisma.bill.aggregate({
      where: match,
      _sum: { totalAmount: true, advancePaid: true, discount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: payMatch,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    totalRevenue: billAgg._sum.totalAmount || 0,
    totalCollection: paymentAgg._sum.amount || billAgg._sum.advancePaid || 0,
    billCount: billAgg._count || 0,
    paymentCount: paymentAgg._count || 0,
    totalDiscount: billAgg._sum.discount || 0,
  };
}

export async function getMonthlyReport() {
  const now = new Date();
  const year = now.getFullYear();

  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({
      where: {
        status: "Active",
        createdAt: { gte: istStartOfDay(`${year}-01-01`), lte: now },
      },
      select: { createdAt: true, totalAmount: true, advancePaid: true, pendingAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        paymentDate: { gte: istStartOfDay(`${year}-01-01`), lte: now },
      },
      select: { paymentDate: true, amount: true },
    }),
  ]);

  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  function monthKey(d: Date): string {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  const revenueMap = new Map<string, { revenue: number; collected: number; pending: number; count: number }>();
  for (const b of bills) {
    const key = monthKey(b.createdAt);
    const entry = revenueMap.get(key) || { revenue: 0, collected: 0, pending: 0, count: 0 };
    entry.revenue += b.totalAmount || 0;
    entry.collected += b.advancePaid || 0;
    entry.pending += b.pendingAmount || 0;
    entry.count += 1;
    revenueMap.set(key, entry);
  }

  const collectionMap = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const key = monthKey(p.paymentDate);
    const entry = collectionMap.get(key) || { total: 0, count: 0 };
    entry.total += p.amount || 0;
    entry.count += 1;
    collectionMap.set(key, entry);
  }

  const monthlyRevenue = Array.from(revenueMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      _id: key,
      revenue: val.revenue,
      collected: val.collected,
      pending: val.pending,
      count: val.count,
    }));

  const monthlyCollection = Array.from(collectionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      _id: key,
      total: val.total,
      count: val.count,
    }));

  return { monthlyRevenue, monthlyCollection };
}

export async function getCustomerReport(filters?: {
  city?: string;
  startDate?: string;
  endDate?: string;
}) {
  const match: Record<string, unknown> = {};
  if (filters?.city) match.city = filters.city;
  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.gte = istStartOfDay(filters.startDate);
    if (filters.endDate) dateFilter.lte = istEndOfDay(filters.endDate);
    match.createdAt = dateFilter;
  }

  const todayMatch = filters?.startDate || filters?.endDate
    ? match
    : { createdAt: { gte: istStartOfToday() } };

  const [topCustomers, newCustomers, totalCustomers, cityBreakdown] = await Promise.all([
    prisma.customer.findMany({
      where: match,
      orderBy: { totalSpent: "desc" },
      take: 10,
      select: { name: true, mobile: true, totalSpent: true, totalVisits: true, city: true },
    }),
    prisma.customer.count({ where: todayMatch }),
    prisma.customer.count({ where: match }),
    prisma.customer.groupBy({
      by: ["city"],
      where: match,
      _count: true,
      orderBy: { _count: { city: "desc" } },
      take: 20,
    }),
  ]);

  return { topCustomers, newCustomers, totalCustomers, cityBreakdown };
}

export async function getInventoryReport(category?: string) {
  const match: Record<string, unknown> = {};
  if (category) match.category = category;

  const [allItems, categoryItems, lowStockItems, locationItems] = await Promise.all([
    prisma.inventory.findMany({
      where: match,
      select: { quantity: true, sellingPrice: true },
    }),
    prisma.inventory.groupBy({
      by: ["category"],
      where: match,
      _count: true,
      _sum: { quantity: true },
    }),
    prisma.inventory.findMany({
      where: { quantity: { lte: 5 }, ...match },
      orderBy: { quantity: "asc" },
      take: 20,
    }),
    prisma.inventory.groupBy({
      by: ["location"],
      where: match,
      _count: true,
    }),
  ]);

  let totalItems = 0;
  let totalQuantity = 0;
  let totalValue = 0;
  let totalPriceSum = 0;
  for (const item of allItems) {
    totalItems += 1;
    totalQuantity += item.quantity || 0;
    totalValue += (item.quantity || 0) * (item.sellingPrice || 0);
    totalPriceSum += item.sellingPrice || 0;
  }
  const avgSellingPrice = totalItems > 0 ? totalPriceSum / totalItems : 0;

  const categoryBreakdown = categoryItems.map((c) => {
    const catItems = allItems; // recompute per-category from raw data
    return { _id: c.category, count: c._count, totalQuantity: c._sum.quantity || 0, totalValue: 0 };
  });

  // Compute per-category totalValue by re-querying grouped data
  const catGroups = await prisma.inventory.groupBy({
    by: ["category"],
    where: match,
    _sum: { quantity: true },
  });

  const catTotals = new Map<string, number>();
  for (const g of catGroups) {
    // Fetch items in this category to compute totalValue (since $multiply isn't supported)
    const items = await prisma.inventory.findMany({
      where: { ...match, category: g.category },
      select: { quantity: true, sellingPrice: true },
    });
    const catTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.sellingPrice || 0), 0);
    catTotals.set(g.category, catTotal);
  }

  const categoryBreakdownFinal = categoryItems.map((c) => ({
    _id: c.category,
    count: c._count,
    totalQuantity: c._sum.quantity || 0,
    totalValue: catTotals.get(c.category) || 0,
  }));

  // Compute valueByLocation
  const locationGroups = await prisma.inventory.groupBy({
    by: ["location"],
    where: match,
  });

  const valueByLocation = [];
  for (const loc of locationGroups) {
    const locItems = await prisma.inventory.findMany({
      where: { ...match, location: loc.location },
      select: { quantity: true, sellingPrice: true },
    });
    const locValue = locItems.reduce((s, i) => s + (i.quantity || 0) * (i.sellingPrice || 0), 0);
    valueByLocation.push({ _id: loc.location, totalValue: locValue, count: locItems.length });
  }

  return {
    overview: { totalItems, totalQuantity, totalValue, avgSellingPrice },
    categoryBreakdown: categoryBreakdownFinal,
    lowStockItems,
    valueByLocation,
  };
}

export async function getDeliveryReport() {
  const [statusCounts, overdueDeliveries, deliveryData] = await Promise.all([
    prisma.delivery.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.delivery.findMany({
      where: {
        status: { in: ["Pending", "In Transit"] },
        expectedDeliveryDate: { lt: new Date() },
      },
      include: {
        customer: { select: { name: true, mobile: true } },
        order: { select: { frame: true, lens: true, status: true } },
      },
      orderBy: { expectedDeliveryDate: "asc" },
      take: 20,
    }),
    prisma.delivery.findMany({
      where: {
        actualDeliveryDate: { not: null },
        expectedDeliveryDate: { not: null },
      },
      select: { actualDeliveryDate: true, expectedDeliveryDate: true },
    }),
  ]);

  let avgDeliveryDays = 0;
  if (deliveryData.length > 0) {
    const totalDiffMs = deliveryData.reduce((sum, d) => {
      const diff = d.actualDeliveryDate!.getTime() - d.expectedDeliveryDate!.getTime();
      return sum + diff;
    }, 0);
    avgDeliveryDays = Math.round((totalDiffMs / (deliveryData.length * 1000 * 60 * 60 * 24)) * 10) / 10;
  }

  return {
    statusCounts,
    overdueDeliveries,
    avgDeliveryDays,
  };
}
