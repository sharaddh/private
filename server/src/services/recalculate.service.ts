import { Customer } from "../models/customer";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { Visit } from "../models/visit";

export async function recalculateCustomerTotals() {
  const customers = await Customer.find().select("_id").lean();
  let updated = 0;

  const recalculationPromises = customers.map(async (customer) => {
    const cid = customer._id;

    const [visitCount, billAgg, paymentAgg] = await Promise.all([
      Visit.countDocuments({ customerId: cid }),
      Bill.aggregate([
        { $match: { customerId: cid, status: "Active" } },
        { $group: { _id: null, totalSpent: { $sum: "$totalAmount" }, pendingAmount: { $sum: "$pendingAmount" } } },
      ]),
      Payment.aggregate([
        { $match: { customerId: cid } },
        { $group: { _id: null, paid: { $sum: "$amount" } } },
      ]),
    ]);

    const totalSpent = billAgg[0]?.totalSpent || 0;
    const billedPending = billAgg[0]?.pendingAmount || 0;
    const totalPaid = paymentAgg[0]?.paid || 0;
    const pendingAmount = Math.max(0, billedPending - totalPaid);

    await Customer.findByIdAndUpdate(cid, {
      $set: {
        totalVisits: visitCount,
        totalSpent,
        pendingAmount,
      },
    });

    updated++;
  });

  await Promise.all(recalculationPromises);

  return { total: customers.length, updated };
}
