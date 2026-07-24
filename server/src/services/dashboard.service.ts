import mongoose from "mongoose";
import { Customer } from "../models/customer";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Inventory } from "../models/inventory";
import { Delivery } from "../models/delivery";
import { Visit } from "../models/visit";

function getDayRange(date?: Date): { start: Date; end: Date } {
  const d = date || new Date();
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function calcTrend(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: current > 0 ? "up" : "flat" };
  const pct = ((current - previous) / previous) * 100;
  return {
    value: Math.round(Math.abs(pct)),
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

export async function getStats() {
  const { start: dayStart, end: dayEnd } = getDayRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  const prevDay = new Date(dayStart);
  prevDay.setDate(prevDay.getDate() - 1);
  const { start: prevDayStart, end: prevDayEnd } = getDayRange(prevDay);

  const thirtyDaysAgo = new Date(dayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const prevMonthEnd = new Date(monthStart);
  prevMonthEnd.setDate(0);
  prevMonthEnd.setHours(23, 59, 59, 999);

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
    prevDaySalesResult,
    monthSalesPrevResult,
    prevDayCollectionResult,
    dailySalesAgg,
    paymentModeSplit,
    orderStatusCounts,
    todayDeliveredOrders,
    todayOrderCount,
    weekOrderCount,
    monthOrderCount,
    todayBillCount,
    weekBillCount,
    monthBillCount,
    incompleteOrders,
    orderCounts,
    paymentCounts,
    dailyCollectionAgg,
    weeklyOrderTrend,
    categoryBreakdown,
    todayPaymentModeSplit,
  ] = await Promise.all([
    Customer.countDocuments(),
    Order.countDocuments(),
    Bill.countDocuments({ status: "Active" }),
    Payment.countDocuments(),
    Inventory.countDocuments(),
    Delivery.countDocuments(),
    Visit.countDocuments(),
    Bill.aggregate([
      { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, status: "Active" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: dayStart, $lte: dayEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Bill.aggregate([
      { $match: { createdAt: { $gte: weekStart, $lte: weekEnd }, status: "Active" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Bill.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd }, status: "Active" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Delivery.countDocuments({ status: "Ready" }),
    Customer.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
    Inventory.countDocuments({ quantity: { $lte: 5 } }),
    Bill.find({ status: "Active", pendingAmount: { $gt: 0 } }).sort({ createdAt: -1 }).limit(10).populate("customerId", "name mobile").lean(),
    Customer.find().sort({ createdAt: -1 }).limit(5).select("name mobile totalSpent totalVisits").lean(),
    Order.find().sort({ createdAt: -1 }).limit(10).populate("customerId", "name mobile").lean(),
    Delivery.find({ status: { $in: ["Pending", "In Transit"] } }).sort({ expectedDeliveryDate: 1 }).limit(10).populate("customerId", "name mobile").lean(),
    Bill.aggregate([
      { $match: { createdAt: { $gte: prevDayStart, $lte: prevDayEnd }, status: "Active" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Bill.aggregate([
      { $match: { createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }, status: "Active" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: prevDayStart, $lte: prevDayEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Bill.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo, $lte: dayEnd }, status: "Active" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: "$paymentMode", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.find({ status: "Delivered", actualDeliveryDate: { $gte: dayStart, $lte: dayEnd } }).populate("customerId", "name mobile").sort({ actualDeliveryDate: -1 }).lean(),
    Order.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
    Order.countDocuments({ createdAt: { $gte: weekStart, $lte: weekEnd } }),
    Order.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
    Bill.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd }, status: "Active" }),
    Bill.countDocuments({ createdAt: { $gte: weekStart, $lte: weekEnd }, status: "Active" }),
    Bill.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd }, status: "Active" }),
    Order.find({ status: { $in: ["Draft", "Ordered", "In Lab"] } }).sort({ createdAt: -1 }).populate("customerId", "name mobile").lean(),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo, $lte: dayEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: thirtyDaysAgo, $lte: dayEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } }, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: thirtyDaysAgo, $lte: dayEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } }, total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo, $lte: dayEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Inventory.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 }, totalValue: { $sum: { $multiply: ["$sellingPrice", "$quantity"] } } } },
      { $sort: { count: -1 } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: dayStart, $lte: dayEnd } } },
      { $group: { _id: "$paymentMode", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const todaySales = todaySalesResult[0]?.total || 0;
  const todayCollection = todayCollectionResult[0]?.total || 0;
  const weekSales = weekSalesResult[0]?.total || 0;
  const monthSales = monthSalesResult[0]?.total || 0;
  const prevDaySales = prevDaySalesResult[0]?.total || 0;
  const prevMonthSales = monthSalesPrevResult[0]?.total || 0;
  const prevDayCollection = prevDayCollectionResult[0]?.total || 0;

  const salesTrendObj = calcTrend(monthSales, prevMonthSales);
  const salesTrend = salesTrendObj.direction === "flat" ? "0" : `${salesTrendObj.direction === "up" ? "" : "-"}${salesTrendObj.value}`;

  const mappedDailySales = dailySalesAgg.map((d: { _id: string; total: number; count: number }) => ({ date: d._id, total: d.total }));
  const mappedDailyCollections = dailyCollectionAgg.map((d: { _id: string; total: number }) => ({ date: d._id, total: d.total }));
  const mappedWeeklyOrderTrend = weeklyOrderTrend.map((d: { _id: string; count: number }) => ({ date: d._id, count: d.count }));
  const mappedCategoryBreakdown = categoryBreakdown.map((d: { _id: string; count: number; totalValue: number }) => ({ category: d._id, count: d.count, totalValue: d.totalValue }));

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
    recentOrders,
    todayDeliveries,
    pendingBills,
    incompleteOrders,
    orderCounts,
    paymentCounts,
    dailySales: mappedDailySales,
    paymentModeSplit,
    orderStatusCounts,
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
    todayPaymentModeSplit,
  };
}
