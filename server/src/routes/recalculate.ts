import { Router } from "express";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Bill } from "../models/bill";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { invalidateCache } from "../middleware/cache";

const router = Router();

router.post("/customer-totals", authenticate, asyncHandler(async (req, res) => {
  const customers = await Customer.find({}).lean();
  const results: Array<{ customerId: string; name: string; mobile: string; old: any; new: any }> = [];
  let updated = 0;

  for (const c of customers) {
    const [visitCount, billAgg] = await Promise.all([
      Visit.countDocuments({ customerId: c._id }),
      Bill.aggregate([
        { $match: { customerId: c._id } },
        { $group: { _id: null, totalSpent: { $sum: "$totalAmount" }, totalPending: { $sum: "$pendingAmount" } } },
      ]),
    ]);

    const totalSpent = billAgg[0]?.totalSpent || 0;
    const totalPending = billAgg[0]?.totalPending || 0;

    const oldVisits = c.totalVisits || 0;
    const oldSpent = c.totalSpent || 0;
    const oldPending = c.pendingAmount || 0;

    if (oldVisits !== visitCount || Math.abs(oldSpent - totalSpent) > 0.01 || Math.abs(oldPending - totalPending) > 0.01) {
      await Customer.findByIdAndUpdate(c._id, {
        $set: { totalVisits: visitCount, totalSpent, pendingAmount: totalPending },
      });
      updated++;
      results.push({
        customerId: c.customerId || "",
        name: c.name || "",
        mobile: c.mobile || "",
        old: { visits: oldVisits, spent: oldSpent, pending: oldPending },
        new: { visits: visitCount, spent: totalSpent, pending: totalPending },
      });
    }
  }

  await Promise.all([
    invalidateCache("/api/customers"),
    invalidateCache("/api/dashboard"),
  ]);

  res.json({
    success: true,
    data: { total: customers.length, updated, details: results },
  });
}));

export default router;
