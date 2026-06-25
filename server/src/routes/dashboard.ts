
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

const router = Router();

router.get("/stats", authenticate, async (req, res) => {
  try {
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

    const [todaySales, todayCollection, readyDeliveries, newCustomersToday, lowStock, pendingPayments, recentCustomers, recentOrders, todayDeliveries, pendingBills, incompleteOrders] =
      await Promise.all([
        Bill.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Payment.aggregate([
          { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
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
          return orders.map(o => ({ ...o, prescription: o.visitId ? rxMap.get(o.visitId.toString()) || null : null }));
        })(),
      ]);

    res.json({
      success: true,
      data: {
        counts: { customers, orders, bills, payments, inventory, deliveries, visits },
        todaySales: todaySales[0]?.total || 0,
        todayCollection: todayCollection[0]?.total || 0,
        readyDeliveries,
        newCustomersToday,
        lowStock,
        pendingPayments: pendingPayments[0]?.total || 0,
        recentCustomers,
        recentOrders,
        todayDeliveries,
        pendingBills,
        incompleteOrders,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
