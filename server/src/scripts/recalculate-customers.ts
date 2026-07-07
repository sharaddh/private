import { connect, disconnect } from "mongoose";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Bill } from "../models/bill";

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/kmj";
  console.log(`Connecting to ${mongoUri}...`);
  await connect(mongoUri);
  console.log("Connected.\n");

  const customers = await Customer.find({}).lean();
  console.log(`Found ${customers.length} customers.\n`);

  let updated = 0;

  for (const c of customers) {
    const [visitCount, billAgg] = await Promise.all([
      Visit.countDocuments({ customerId: c._id }),
      Bill.aggregate([
        { $match: { customerId: c._id } },
        { $group: { _id: null, totalSpent: { $sum: "$totalAmount" }, totalPending: { $sum: "$pendingAmount" } } },
      ]),
    ]);

    const totalSpent = Math.round((billAgg[0]?.totalSpent || 0) * 100) / 100;
    const totalPending = Math.round((billAgg[0]?.totalPending || 0) * 100) / 100;

    const oldVisits = c.totalVisits || 0;
    const oldSpent = c.totalSpent || 0;
    const oldPending = c.pendingAmount || 0;

    if (oldVisits !== visitCount || Math.abs(oldSpent - totalSpent) > 0.01 || Math.abs(oldPending - totalPending) > 0.01) {
      console.log(
        `[${c.customerId || "—"}] ${c.name || "?"}  ${c.mobile || ""}\n` +
        `  Visits: ${oldVisits} -> ${visitCount}\n` +
        `  Spent:  ₹${oldSpent} -> ₹${totalSpent}\n` +
        `  Pending: ₹${oldPending} -> ₹${totalPending}\n`
      );

      await Customer.findByIdAndUpdate(c._id, {
        $set: { totalVisits: visitCount, totalSpent, pendingAmount: totalPending },
      });
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} of ${customers.length} customers.`);
  await disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
