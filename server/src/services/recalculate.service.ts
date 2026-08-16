import { prisma } from "../db/prisma";

export async function recalculateCustomerTotals() {
  const customers = await prisma.customer.findMany({ select: { id: true } });
  if (customers.length === 0) return { total: 0, updated: 0 };

  const customerIds = customers.map((c) => c.id);

  const [visitCounts, billAggs, paymentAggs] = await Promise.all([
    prisma.visit.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds } },
      _count: true,
    }),
    prisma.bill.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, status: "Active" },
      _sum: { totalAmount: true, pendingAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds } },
      _sum: { amount: true },
    }),
  ]);

  const visitMap = new Map(
    visitCounts.map((v) => [v.customerId, v._count])
  );
  const billMap = new Map(
    billAggs.map((b) => [b.customerId, b])
  );
  const paymentMap = new Map(
    paymentAggs.map((p) => [p.customerId, p._sum.amount || 0])
  );

  const updates = customers.map((customer) => {
    const cid = customer.id;
    const visitCount = visitMap.get(cid) || 0;
    const billAgg = billMap.get(cid);
    const totalSpent = billAgg?._sum.totalAmount || 0;
    const billedPending = billAgg?._sum.pendingAmount || 0;
    const totalPaid = paymentMap.get(cid) || 0;
    const pendingAmount = Math.max(0, billedPending - totalPaid);

    return {
      id: cid,
      data: { totalVisits: visitCount, totalSpent, pendingAmount },
    };
  });

  const result = await Promise.all(
    updates.map(({ id, data }) => prisma.customer.update({ where: { id }, data }))
  );

  return { total: customers.length, updated: result.length };
}
