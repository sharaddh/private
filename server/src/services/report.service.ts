import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Order } from "../models/order";
import { Inventory } from "../models/inventory";
import { Delivery } from "../models/delivery";
import { AppError } from "../middleware/errorHandler";

export async function getRevenueReport(start?: string, end?: string) {
  const match: Record<string, unknown> = {};
  const payMatch: Record<string, unknown> = {};

  if (start || end) {
    const dateFilter: Record<string, Date> = {};
    if (start) dateFilter.$gte = new Date(start);
    if (end) dateFilter.$lte = new Date(end + "T23:59:59.999Z");
    match.createdAt = dateFilter;
    payMatch.paymentDate = { ...dateFilter };
  }

  const [billAgg, paymentAgg] = await Promise.all([
    Bill.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCollection: { $sum: "$advancePaid" },
          totalDiscount: { $sum: "$discount" },
          billCount: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      { $match: payMatch },
      {
        $group: {
          _id: null,
          totalCollection: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const bill = billAgg[0] || { totalRevenue: 0, totalCollection: 0, totalDiscount: 0, billCount: 0 };
  const pay = paymentAgg[0] || { totalCollection: 0, paymentCount: 0 };

  return {
    totalRevenue: bill.totalRevenue || 0,
    totalCollection: pay.totalCollection || bill.totalCollection || 0,
    billCount: bill.billCount || 0,
    paymentCount: pay.paymentCount || 0,
    totalDiscount: bill.totalDiscount || 0,
  };
}

export async function getMonthlyReport() {
  const now = new Date();
  const year = now.getFullYear();

  const monthlyRevenue = await Bill.aggregate([
    { $match: { status: "Active", createdAt: { $gte: new Date(year, 0, 1), $lte: now } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        revenue: { $sum: "$totalAmount" },
        collected: { $sum: "$advancePaid" },
        pending: { $sum: "$pendingAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthlyCollection = await Payment.aggregate([
    { $match: { paymentDate: { $gte: new Date(year, 0, 1), $lte: now } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { monthlyRevenue, monthlyCollection };
}

export async function getCustomerReport(filters?: { city?: string; startDate?: string; endDate?: string }) {
  const match: Record<string, unknown> = {};
  if (filters?.city) match.city = filters.city;
  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.$gte = new Date(filters.startDate);
    if (filters.endDate) dateFilter.$lte = new Date(filters.endDate);
    match.createdAt = dateFilter;
  }

  const [topCustomers, newCustomers, totalCustomers, cityBreakdown] = await Promise.all([
    Customer.find(match).sort({ totalSpent: -1 }).limit(10).select("name mobile totalSpent totalVisits city").lean(),
    Customer.countDocuments(filters?.startDate || filters?.endDate ? match : { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Customer.countDocuments(match),
    Customer.aggregate([
      { $match: match },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  return { topCustomers, newCustomers, totalCustomers, cityBreakdown };
}

export async function getInventoryReport(category?: string) {
  const match: Record<string, unknown> = {};
  if (category) match.category = category;

  const [stats, categoryBreakdown, lowStockItems, totalValue] = await Promise.all([
    Inventory.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } },
          avgSellingPrice: { $avg: "$sellingPrice" },
        },
      },
    ]),
    Inventory.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } },
        },
      },
      { $sort: { totalValue: -1 } },
    ]),
    Inventory.find({ quantity: { $lte: 5 }, ...match }).sort({ quantity: 1 }).limit(20).lean(),
    Inventory.aggregate([
      { $match: match },
      { $group: { _id: "$location", totalValue: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    overview: stats[0] || { totalItems: 0, totalQuantity: 0, totalValue: 0, avgSellingPrice: 0 },
    categoryBreakdown,
    lowStockItems,
    valueByLocation: totalValue,
  };
}

export async function getDeliveryReport() {
  const [statusCounts, overdueDeliveries, avgDeliveryTime] = await Promise.all([
    Delivery.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Delivery.find({
      status: { $in: ["Pending", "In Transit"] },
      expectedDeliveryDate: { $lt: new Date() },
    })
      .populate("customerId", "name mobile")
      .populate("orderId", "frame lens status")
      .sort({ expectedDeliveryDate: 1 })
      .limit(20)
      .lean(),
    Delivery.aggregate([
      { $match: { actualDeliveryDate: { $exists: true }, expectedDeliveryDate: { $exists: true } } },
      {
        $project: {
          diff: { $subtract: ["$actualDeliveryDate", "$expectedDeliveryDate"] },
        },
      },
      { $group: { _id: null, avgDiff: { $avg: "$diff" } } },
    ]),
  ]);

  return {
    statusCounts,
    overdueDeliveries,
    avgDeliveryDays: avgDeliveryTime[0]?.avgDiff
      ? Math.round(avgDeliveryTime[0].avgDiff / (1000 * 60 * 60 * 24) * 10) / 10
      : 0,
  };
}
