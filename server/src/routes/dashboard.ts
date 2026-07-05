import { Router } from "express";
import { Customer } from "../models/customer";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Inventory } from "../models/inventory";
import { Delivery } from "../models/delivery";
import { Visit } from "../models/visit";
import { Prescription } from "../models/prescription";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";

const router = Router();

function getDayRange(date: Date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getWeekRange(date: Date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function getMonthRange(date: Date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

router.get("/stats", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
    const [
      customers,
      orders,
      bills,
      payments,
      inventory,
      deliveries,
      visits,
    ] = await Promise.all([
      Customer.countDocuments(),
      Order.countDocuments(),
      Bill.countDocuments(),
      Payment.countDocuments(),
      Inventory.countDocuments(),
      Delivery.countDocuments(),
      Visit.countDocuments(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { start: weekStart } = getWeekRange();
    const { start: monthStart } = getMonthRange();

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const sameDayLastWeek = new Date(today);
    sameDayLastWeek.setDate(sameDayLastWeek.getDate() - 7);
    const sameDayLastWeekEnd = new Date(sameDayLastWeek);
    sameDayLastWeekEnd.setDate(sameDayLastWeekEnd.getDate() + 1);

    const calcTrend = (current: number, previous: number): string => {
      if (!previous) return current ? "+100" : "0";
      return ((current - previous) / previous * 100).toFixed(1);
    };

    const [todaySales, todayCollection, weekSales, monthSales, readyDeliveries, newCustomersToday, lowStock, pendingPayments, recentCustomers, recentOrders, todayDeliveries, pendingBills, incompleteOrders, todayOrdersCount, weekOrdersCount, monthOrdersCount, todayBillsCount, weekBillsCount, monthBillsCount, dailySalesData, paymentModeData, orderStatusData, sameDayLastWeekSales] =
      await Promise.all([
        Bill.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Payment.aggregate([
          { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Bill.aggregate([
          { $match: { createdAt: { $gte: weekStart, $lt: today } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Bill.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lt: today } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Delivery.countDocuments({ status: "Ready" }),
        Customer.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Inventory.countDocuments({ quantity: { $lte: 5 } }),
        Payment.aggregate([
          {
            $lookup: {
              from: "bills",
              localField: "billId",
              foreignField: "_id",
              as: "bill",
            },
          },
          { $unwind: { path: "$bill", preserveNullAndEmptyArrays: true } },
          { $match: { "bill.pendingAmount": { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: "$bill.pendingAmount" } } },
        ]),
        Customer.find().sort({ createdAt: -1 }).limit(5),
        Order.find().sort({ createdAt: -1 }).limit(5),
        Delivery.find({
          $or: [
            { expectedDeliveryDate: { $gte: today, $lt: tomorrow } },
            { status: { $in: ["Pending", "Ready"] } },
          ],
        })
          .populate("customerId", "name mobile")
          .sort({ expectedDeliveryDate: 1 })
          .limit(10),
        Bill.find({ pendingAmount: { $gt: 0 } })
          .populate("customerId", "name mobile")
          .sort({ pendingAmount: -1 })
          .limit(5),
        (async () => {
          const orders = await Order.find({ status: { $in: ["Draft", "Ordered", "In Lab"] } })
            .populate("customerId", "name mobile")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
          const visitIds = orders.map(o => o.visitId).filter(Boolean);
          const prescriptions = visitIds.length > 0
            ? await Prescription.find({ visitId: { $in: visitIds } }).lean()
            : [];
          const rxMap = new Map(prescriptions.map(p => [p.visitId!.toString(), p]));
          const ordersWithRx = orders.map(o => ({ ...o, prescription: o.visitId ? rxMap.get(o.visitId.toString()) || null : null }));
          const brandNames = [...new Set(ordersWithRx.flatMap(o => [o.lensBrand, o.frameBrand].filter(Boolean)))];
          const stockItems = brandNames.length > 0
            ? await Inventory.find({ brand: { $in: brandNames } }).lean()
            : [];
          const stockMap = new Map<string, { shop: number; warehouse: number }>();
          for (const item of stockItems) {
            const key = (item.brand || "").toLowerCase();
            const loc = (item.location || "shop") as string;
            const entry = stockMap.get(key) || { shop: 0, warehouse: 0 };
            if (loc === "warehouse") entry.warehouse += (item.quantity || 0);
            else entry.shop += (item.quantity || 0);
            stockMap.set(key, entry);
          }
          return ordersWithRx.map(o => {
            const lensKey = (o.lensBrand as string || "").toLowerCase();
            const frameKey = (o.frameBrand as string || "").toLowerCase();
            const lensStock = stockMap.get(lensKey);
            const frameStock = stockMap.get(frameKey);
            return {
              ...o,
              stockStatus: {
                lensBrand: lensStock ? { shop: lensStock.shop, warehouse: lensStock.warehouse } : null,
                frameBrand: frameStock ? { shop: frameStock.shop, warehouse: frameStock.warehouse } : null,
              },
            };
          });
        })(),
        Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Order.countDocuments({ createdAt: { $gte: weekStart, $lt: tomorrow } }),
        Order.countDocuments({ createdAt: { $gte: monthStart, $lt: tomorrow } }),
        Bill.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Bill.countDocuments({ createdAt: { $gte: weekStart, $lt: tomorrow } }),
        Bill.countDocuments({ createdAt: { $gte: monthStart, $lt: tomorrow } }),
        Bill.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo, $lt: tomorrow } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              total: { $sum: "$totalAmount" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Payment.aggregate([
          { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: "$paymentMode", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Bill.aggregate([
          { $match: { createdAt: { $gte: sameDayLastWeek, $lt: sameDayLastWeekEnd } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

    res.json({
      success: true,
      data: {
        counts: { customers, orders, bills, payments, inventory, deliveries, visits },
        todaySales: todaySales[0]?.total || 0,
        todayCollection: todayCollection[0]?.total || 0,
        weekSales: weekSales[0]?.total || 0,
        monthSales: monthSales[0]?.total || 0,
        readyDeliveries,
        newCustomersToday,
        lowStock,
        pendingPayments: pendingPayments[0]?.total || 0,
        recentCustomers,
        recentOrders,
        todayDeliveries,
        pendingBills,
        incompleteOrders,
        todayOrders: todayOrdersCount,
        weekOrders: weekOrdersCount,
        monthOrders: monthOrdersCount,
        todayBills: todayBillsCount,
        weekBills: weekBillsCount,
        monthBills: monthBillsCount,
        dailySales: dailySalesData.map(d => ({ date: d._id, total: d.total })),
        paymentModeSplit: paymentModeData.map(d => ({ mode: d._id || "Unknown", total: d.total, count: d.count })),
        orderStatusCounts: orderStatusData.map(d => ({ status: d._id, count: d.count })),
        salesTrend: calcTrend(todaySales[0]?.total || 0, sameDayLastWeekSales[0]?.total || 0),
      },
    });
}));

export default router;
