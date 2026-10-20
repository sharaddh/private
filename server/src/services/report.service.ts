import { prisma } from "../db/prisma";
import { requireBranchId } from "../utils/scope";
import { istStartOfDay, istEndOfDay, istStartOfToday } from "../utils/date";

export async function getRevenueReport(start?: string, end?: string) {
  const branchId = requireBranchId();
  const match: Record<string, unknown> = { branchId };
  const payMatch: Record<string, unknown> = { branchId };

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
  const branchId = requireBranchId();
  const now = new Date();
  const year = now.getFullYear();

  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({
      where: {
        branchId,
        status: "Active",
        createdAt: { gte: istStartOfDay(`${year}-01-01`), lte: now },
      },
      select: { createdAt: true, totalAmount: true, advancePaid: true, pendingAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        branchId,
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
  const branchId = requireBranchId();
  const match: Record<string, unknown> = { branchId };
  if (filters?.city) match.city = filters.city;
  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.gte = istStartOfDay(filters.startDate);
    if (filters.endDate) dateFilter.lte = istEndOfDay(filters.endDate);
    match.createdAt = dateFilter;
  }

  const todayMatch = filters?.startDate || filters?.endDate
    ? match
    : { branchId, createdAt: { gte: istStartOfToday() } };

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
  const branchId = requireBranchId();
  const match: Record<string, unknown> = { branchId };
  if (category) match.category = category;

  const [allItems, lowStockItems] = await Promise.all([
    prisma.inventory.findMany({
      where: match,
      select: { category: true, location: true, quantity: true, sellingPrice: true },
    }),
    prisma.inventory.findMany({
      where: { quantity: { lte: 5 }, ...match },
      orderBy: { quantity: "asc" },
      take: 20,
    }),
  ]);

  let totalItems = 0;
  let totalQuantity = 0;
  let totalValue = 0;
  let totalPriceSum = 0;

  const catMap = new Map<
    string,
    { count: number; totalQuantity: number; totalValue: number }
  >();
  const locMap = new Map<string, { count: number; totalValue: number }>();

  for (const item of allItems) {
    const qty = item.quantity || 0;
    const price = item.sellingPrice || 0;
    const value = qty * price;
    totalItems += 1;
    totalQuantity += qty;
    totalValue += value;
    totalPriceSum += price;

    const cat = catMap.get(item.category) ?? {
      count: 0,
      totalQuantity: 0,
      totalValue: 0,
    };
    cat.count += 1;
    cat.totalQuantity += qty;
    cat.totalValue += value;
    catMap.set(item.category, cat);

    const loc = locMap.get(item.location) ?? { count: 0, totalValue: 0 };
    loc.count += 1;
    loc.totalValue += value;
    locMap.set(item.location, loc);
  }

  const avgSellingPrice = totalItems > 0 ? totalPriceSum / totalItems : 0;

  const categoryBreakdown = Array.from(catMap.entries()).map(
    ([category, data]) => ({ _id: category, ...data })
  );
  const valueByLocation = Array.from(locMap.entries()).map(
    ([location, data]) => ({ _id: location, ...data })
  );

  return {
    overview: { totalItems, totalQuantity, totalValue, avgSellingPrice },
    categoryBreakdown,
    lowStockItems,
    valueByLocation,
  };
}

export async function getDeliveryReport() {
  const branchId = requireBranchId();
  const [statusCounts, overdueDeliveries, deliveryData] = await Promise.all([
    prisma.delivery.groupBy({
      by: ["status"],
      where: { branchId },
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.delivery.findMany({
      where: {
        branchId,
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
        branchId,
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
