import { Router } from "express";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Inventory } from "../models/inventory";
import { Delivery } from "../models/delivery";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { cacheRoute } from "../middleware/cache";

const router = Router();

router.get("/revenue", authenticate, cacheRoute(60), asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  const billFilter: Record<string, unknown> = {};
  const paymentFilter: Record<string, unknown> = {};
  if (start || end) {
    billFilter.createdAt = {};
    paymentFilter.paymentDate = {};
    if (start) {
      (billFilter.createdAt as Record<string, unknown>).$gte = new Date(start as string);
      (paymentFilter.paymentDate as Record<string, unknown>).$gte = new Date(start as string);
    }
    if (end) {
      const endDate = new Date(end as string);
      endDate.setUTCHours(23, 59, 59, 999);
      (billFilter.createdAt as Record<string, unknown>).$lte = endDate;
      (paymentFilter.paymentDate as Record<string, unknown>).$lte = endDate;
    }
  }
  const [billAgg, paymentAgg] = await Promise.all([
    Bill.aggregate([
      { $match: billFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 }, discount: { $sum: "$discount" } } },
    ]),
    Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      totalRevenue: billAgg[0]?.total || 0,
      billCount: billAgg[0]?.count || 0,
      totalDiscount: billAgg[0]?.discount || 0,
      totalCollection: paymentAgg[0]?.total || 0,
      paymentCount: paymentAgg[0]?.count || 0,
    },
  });
}));

router.get("/monthly", authenticate, cacheRoute(120), asyncHandler(async (req, res) => {
  const [revenue, collection] = await Promise.all([
    Bill.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
    Payment.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
  ]);
  res.json({ success: true, data: { revenue, collection } });
}));

router.get("/customers", authenticate, cacheRoute(120), asyncHandler(async (req, res) => {
  const { start, end, city, tag, type } = req.query;
  const custFilter: Record<string, unknown> = {};
  if (start || end) {
    custFilter.createdAt = {};
    if (start) (custFilter.createdAt as Record<string, unknown>).$gte = new Date(start as string);
    if (end) {
      const endDate = new Date(end as string);
      endDate.setUTCHours(23, 59, 59, 999);
      (custFilter.createdAt as Record<string, unknown>).$lte = endDate;
    }
  }
  if (city) custFilter.city = city;
  if (tag) custFilter.tags = tag;
  if (type === "new") custFilter.totalVisits = { $lte: 1 };
  if (type === "returning") custFilter.totalVisits = { $gt: 1 };

  const [topCustomers, newCustomers, totalCustomers, cityBreakdown] = await Promise.all([
    Customer.find(custFilter).sort({ totalSpent: -1 }).limit(20).lean(),
    Customer.aggregate([
      { $match: custFilter },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]),
    Customer.countDocuments(custFilter),
    Customer.aggregate([
      { $match: custFilter },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);
  res.json({ success: true, data: { topCustomers, newCustomers, totalCustomers, cityBreakdown } });
}));

router.get("/inventory", authenticate, cacheRoute(60), asyncHandler(async (req, res) => {
  const { category } = req.query;
  const invFilter: Record<string, unknown> = {};
  if (category) invFilter.category = category;

  const [allItems, lowStock, byCategory] = await Promise.all([
    Inventory.find(invFilter).lean(),
    Inventory.find({ ...invFilter, quantity: { $lte: 5 } }).sort({ quantity: 1 }).lean(),
    Inventory.aggregate([
      ...(category ? [{ $match: { category } }] : []),
      { $group: { _id: "$category", count: { $sum: 1 }, totalQty: { $sum: "$quantity" } } },
    ]),
  ]);
  const totalItems = allItems.length;
  const totalValue = allItems.reduce((s, i) => s + (i.sellingPrice || 0) * (i.quantity || 0), 0);
  const topSelling = allItems.filter((i) => i.sellingPrice > 0).sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0)).slice(0, 5);
  res.json({ success: true, data: { totalItems, totalValue, lowStock, byCategory, topSelling } });
}));

router.get("/deliveries", authenticate, cacheRoute(30), asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [pending, ready, todayDelivery, overdue] = await Promise.all([
    Delivery.countDocuments({ status: "Pending" }),
    Delivery.countDocuments({ status: "Ready" }),
    Delivery.countDocuments({ expectedDeliveryDate: { $gte: today, $lt: tomorrow } }),
    Delivery.countDocuments({ expectedDeliveryDate: { $lt: today }, status: { $ne: "Delivered" } }),
  ]);
  res.json({ success: true, data: { pending, ready, todayDelivery, overdue } });
}));

export default router;
