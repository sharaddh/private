import { prisma, Prisma } from "../db/prisma";
import { requireBranchId } from "../utils/scope";
import { istStartOfDay, istEndOfDay, istStartOfToday } from "../utils/date";

const inventorySelect = {
  id: true,
  branchId: true,
  sku: true,
  category: true,
  inventoryType: true,
  brand: true,
  model: true,
  color: true,
  size: true,
  gender: true,
  supplier: true,
  quantity: true,
  location: true,
  purchasePrice: true,
  sellingPrice: true,
  description: true,
  lensIndex: true,
  lensCoating: true,
  sphRight: true,
  cylRight: true,
  axisRight: true,
  sphLeft: true,
  cylLeft: true,
  axisLeft: true,
  addPower: true,
  createdAt: true,
  updatedAt: true,
} as const;

type MonthlyRevenueRow = {
  _id: string;
  revenue: number;
  collected: number;
  pending: number;
  count: number;
};
type MonthlyCollectionRow = { _id: string; total: number; count: number };
type InventoryOverviewRow = {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  totalPriceSum: number;
};
type InventoryGroupRow = {
  _id: string;
  count: number;
  totalQuantity?: number;
  totalValue: number;
};
type DeliveryDurationRow = { totalDiffMs: number; count: number };

function monthlyRevenueRows(branchId: string, start: Date, end: Date) {
  return prisma.$queryRaw<MonthlyRevenueRow[]>(Prisma.sql`
    SELECT to_char((("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS "_id",
           COALESCE(SUM("totalAmount"), 0) AS "revenue",
           COALESCE(SUM("advancePaid"), 0) AS "collected",
           COALESCE(SUM("pendingAmount"), 0) AS "pending",
           COUNT(*)::int AS "count"
    FROM "bills"
    WHERE "branchId" = ${branchId}
      AND "status" = 'Active'
      AND "created_at" >= ${start}
      AND "created_at" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
}

function monthlyCollectionRows(branchId: string, start: Date, end: Date) {
  return prisma.$queryRaw<MonthlyCollectionRow[]>(Prisma.sql`
    SELECT to_char((("paymentDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS "_id",
           COALESCE(SUM("amount"), 0) AS "total",
           COUNT(*)::int AS "count"
    FROM "payments"
    WHERE "branchId" = ${branchId}
      AND "paymentDate" >= ${start}
      AND "paymentDate" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
}

function inventoryOverviewRows(branchId: string, categoryFilter: Prisma.Sql) {
  return prisma.$queryRaw<InventoryOverviewRow[]>(Prisma.sql`
    SELECT COUNT(*)::int AS "totalItems",
           COALESCE(SUM("quantity"), 0)::double precision AS "totalQuantity",
           COALESCE(SUM("quantity" * "sellingPrice"), 0)::double precision AS "totalValue",
           COALESCE(SUM("sellingPrice"), 0)::double precision AS "totalPriceSum"
    FROM "inventory"
    WHERE "branchId" = ${branchId}
      ${categoryFilter}
  `);
}

function inventoryCategoryRows(branchId: string, categoryFilter: Prisma.Sql) {
  return prisma.$queryRaw<InventoryGroupRow[]>(Prisma.sql`
    SELECT "category" AS "_id",
           COUNT(*)::int AS "count",
           COALESCE(SUM("quantity"), 0)::double precision AS "totalQuantity",
           COALESCE(SUM("quantity" * "sellingPrice"), 0)::double precision AS "totalValue"
    FROM "inventory"
    WHERE "branchId" = ${branchId}
      ${categoryFilter}
    GROUP BY "category"
  `);
}

function inventoryLocationRows(branchId: string, categoryFilter: Prisma.Sql) {
  return prisma.$queryRaw<InventoryGroupRow[]>(Prisma.sql`
    SELECT "location" AS "_id",
           COUNT(*)::int AS "count",
           COALESCE(SUM("quantity" * "sellingPrice"), 0)::double precision AS "totalValue"
    FROM "inventory"
    WHERE "branchId" = ${branchId}
      ${categoryFilter}
    GROUP BY "location"
  `);
}

function deliveryDurationRows(branchId: string) {
  return prisma.$queryRaw<DeliveryDurationRow[]>(Prisma.sql`
    SELECT COALESCE(
             SUM(EXTRACT(EPOCH FROM ("actualDeliveryDate" - "expectedDeliveryDate"))::double precision * 1000),
             0
           )::double precision AS "totalDiffMs",
           COUNT(*)::int AS "count"
    FROM "deliveries"
    WHERE "branchId" = ${branchId}
      AND "actualDeliveryDate" IS NOT NULL
      AND "expectedDeliveryDate" IS NOT NULL
  `);
}

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

  const [monthlyRevenue, monthlyCollection] = await Promise.all([
    monthlyRevenueRows(branchId, istStartOfDay(`${year}-01-01`), now),
    monthlyCollectionRows(branchId, istStartOfDay(`${year}-01-01`), now),
  ]);

  return {
    monthlyRevenue: monthlyRevenue
      .slice()
      .sort((a, b) => a._id.localeCompare(b._id))
      .map((row) => ({
        _id: row._id,
        revenue: row.revenue,
        collected: row.collected,
        pending: row.pending,
        count: row.count,
      })),
    monthlyCollection: monthlyCollection
      .slice()
      .sort((a, b) => a._id.localeCompare(b._id))
      .map((row) => ({ _id: row._id, total: row.total, count: row.count })),
  };
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

  const todayMatch =
    filters?.startDate || filters?.endDate
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
  const categoryFilter = category ? Prisma.sql`AND "category" = ${category}` : Prisma.sql``;

  const [overviewRows, categoryRows, locationRows, lowStockItems] = await Promise.all([
    inventoryOverviewRows(branchId, categoryFilter),
    inventoryCategoryRows(branchId, categoryFilter),
    inventoryLocationRows(branchId, categoryFilter),
    prisma.inventory.findMany({
      where: { quantity: { lte: 5 }, ...match },
      orderBy: { quantity: "asc" },
      take: 20,
      select: inventorySelect,
    }),
  ]);

  const overview = overviewRows[0];
  const avgSellingPrice =
    overview.totalItems > 0 ? overview.totalPriceSum / overview.totalItems : 0;

  return {
    overview: {
      totalItems: overview.totalItems,
      totalQuantity: overview.totalQuantity,
      totalValue: overview.totalValue,
      avgSellingPrice,
    },
    categoryBreakdown: categoryRows.map((row) => ({
      _id: row._id,
      count: row.count,
      totalQuantity: row.totalQuantity || 0,
      totalValue: row.totalValue,
    })),
    lowStockItems,
    valueByLocation: locationRows.map((row) => ({
      _id: row._id,
      count: row.count,
      totalValue: row.totalValue,
    })),
  };
}

export async function getDeliveryReport() {
  const branchId = requireBranchId();
  const [statusCounts, overdueDeliveries, deliveryDuration] = await Promise.all([
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
    deliveryDurationRows(branchId),
  ]);

  const { totalDiffMs, count } = deliveryDuration[0];
  let avgDeliveryDays = 0;
  if (count > 0) {
    avgDeliveryDays = Math.round((totalDiffMs / (count * 1000 * 60 * 60 * 24)) * 10) / 10;
  }

  return {
    statusCounts,
    overdueDeliveries,
    avgDeliveryDays,
  };
}
