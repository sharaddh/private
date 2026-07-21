import mongoose from "mongoose";
import { Customer } from "../models/customer";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Visit } from "../models/visit";

export async function recalculateCustomerTotals() {
  const customers = await Customer.find().select("_id").lean();
  if (customers.length === 0) return { total: 0, updated: 0 };

  const customerIds = customers.map((c) => c._id);

  const [visitCounts, billAggs, paymentAggs] = await Promise.all([
    Visit.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: "$customerId", count: { $sum: 1 } } },
    ]),
    Bill.aggregate([
      { $match: { customerId: { $in: customerIds }, status: "Active" } },
      { $group: { _id: "$customerId", totalSpent: { $sum: "$totalAmount" }, pendingAmount: { $sum: "$pendingAmount" } } },
    ]),
    Payment.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: "$customerId", paid: { $sum: "$amount" } } },
    ]),
  ]);

  const visitMap = new Map(visitCounts.map((v) => [String(v._id), v.count]));
  const billMap = new Map(billAggs.map((b) => [String(b._id), b]));
  const paymentMap = new Map(paymentAggs.map((p) => [String(p._id), p.paid]));

  const bulkOps = customers.map((customer) => {
    const cid = String(customer._id);
    const visitCount = visitMap.get(cid) || 0;
    const billAgg = billMap.get(cid);
    const totalSpent = billAgg?.totalSpent || 0;
    const billedPending = billAgg?.pendingAmount || 0;
    const totalPaid = paymentMap.get(cid) || 0;
    const pendingAmount = Math.max(0, billedPending - totalPaid);

    return {
      updateOne: {
        filter: { _id: customer._id },
        update: { $set: { totalVisits: visitCount, totalSpent, pendingAmount } },
      },
    };
  });

  const result = await Customer.bulkWrite(bulkOps);

  return { total: customers.length, updated: result.modifiedCount };
}
