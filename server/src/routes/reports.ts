import { Router } from "express";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Customer } from "../models/customer";
import { Order } from "../models/order";
import { Inventory } from "../models/inventory";
import { Delivery } from "../models/delivery";

const router = Router();

router.get("/revenue", async (req, res) => {
  try {
    const { start, end } = req.query;
    const filter: any = {};
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = new Date(start as string);
      if (end) filter.createdAt.$lte = new Date(end as string);
    }
    const revenue = await Bill.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]);
    const collection = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      data: {
        totalRevenue: revenue[0]?.total || 0,
        billCount: revenue[0]?.count || 0,
        totalCollection: collection[0]?.total || 0,
        paymentCount: collection[0]?.count || 0,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/monthly", async (req, res) => {
  try {
    const revenue = await Bill.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);
    const collection = await Payment.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);
    res.json({ success: true, data: { revenue, collection } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const topCustomers = await Customer.find().sort({ totalSpent: -1 }).limit(20);
    const newCustomers = await Customer.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]);
    res.json({ success: true, data: { topCustomers, newCustomers } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/inventory", async (req, res) => {
  try {
    const lowStock = await Inventory.find({ quantity: { $lte: 5 } }).sort({ quantity: 1 });
    const byCategory = await Inventory.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 }, totalQty: { $sum: "$quantity" } } },
    ]);
    res.json({ success: true, data: { lowStock, byCategory } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/deliveries", async (req, res) => {
  try {
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
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
