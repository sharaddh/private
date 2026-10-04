import { describe, it, expect } from "vitest";
import { transactionSchema } from "./workspace.validator";
import {
  statusUpdateSchema,
  collectPaymentSchema as orderCollectPaymentSchema,
} from "./order.validator";
import { collectPaymentSchema as billCollectPaymentSchema } from "./bill.validator";

const twoSplits = [
  { mode: "Cash", amount: 500 },
  { mode: "Card", amount: 500 },
];

describe("workspace transactionSchema — payment.splits", () => {
  it("keeps splits on the parsed output instead of stripping them", () => {
    const parsed = transactionSchema.parse({
      payment: { amount: 1000, mode: "Cash", splits: twoSplits },
    });
    expect(parsed.payment?.splits).toEqual(twoSplits);
  });

  it("still accepts a legacy single-mode payment with no splits", () => {
    const parsed = transactionSchema.parse({ payment: { amount: 500, mode: "Card" } });
    expect(parsed.payment?.amount).toBe(500);
    expect(parsed.payment?.mode).toBe("Card");
    expect(parsed.payment?.splits).toBeUndefined();
  });

  it("rejects a third split row", () => {
    expect(() =>
      transactionSchema.parse({
        payment: {
          splits: [
            { mode: "Cash", amount: 1 },
            { mode: "Card", amount: 1 },
            { mode: "UPI", amount: 1 },
          ],
        },
      })
    ).toThrow();
  });

  it("rejects an invalid mode inside splits", () => {
    expect(() =>
      transactionSchema.parse({ payment: { splits: [{ mode: "Bitcoin", amount: 1 }] } })
    ).toThrow();
  });

  it("rejects a negative amount inside splits", () => {
    expect(() =>
      transactionSchema.parse({ payment: { splits: [{ mode: "Cash", amount: -1 }] } })
    ).toThrow();
  });

  it("rejects a non-array splits value", () => {
    expect(() => transactionSchema.parse({ payment: { splits: "Cash" } })).toThrow();
  });

  it("accepts a single-row splits array", () => {
    const parsed = transactionSchema.parse({
      payment: { splits: [{ mode: "UPI", amount: 200 }] },
    });
    expect(parsed.payment?.splits).toEqual([{ mode: "UPI", amount: 200 }]);
  });
});

describe("order statusUpdateSchema — splits", () => {
  it("keeps splits on the parsed output", () => {
    const parsed = statusUpdateSchema.parse({
      status: "Delivered",
      collectPayment: 1000,
      splits: twoSplits,
    });
    expect(parsed.splits).toEqual(twoSplits);
  });

  it("still accepts a legacy status update with no splits", () => {
    const parsed = statusUpdateSchema.parse({
      status: "Delivered",
      collectPayment: 500,
      paymentMode: "Card",
    });
    expect(parsed.collectPayment).toBe(500);
    expect(parsed.paymentMode).toBe("Card");
    expect(parsed.splits).toBeUndefined();
  });

  it("rejects a third split row", () => {
    expect(() =>
      statusUpdateSchema.parse({
        status: "Delivered",
        splits: [
          { mode: "Cash", amount: 1 },
          { mode: "Card", amount: 1 },
          { mode: "UPI", amount: 1 },
        ],
      })
    ).toThrow();
  });

  it("rejects an invalid mode inside splits", () => {
    expect(() =>
      statusUpdateSchema.parse({ status: "Delivered", splits: [{ mode: "Cash", amount: 1 }, { mode: "Nope", amount: 1 }] })
    ).toThrow();
  });
});

describe("order collectPaymentSchema — splits", () => {
  it("keeps splits on the parsed output", () => {
    const parsed = orderCollectPaymentSchema.parse({
      collectPayment: 1000,
      splits: twoSplits,
    });
    expect(parsed.splits).toEqual(twoSplits);
  });

  it("still accepts a legacy collection with no splits", () => {
    const parsed = orderCollectPaymentSchema.parse({ collectPayment: 300, paymentMode: "UPI" });
    expect(parsed.collectPayment).toBe(300);
    expect(parsed.paymentMode).toBe("UPI");
  });

  it("rejects a third split row", () => {
    expect(() =>
      orderCollectPaymentSchema.parse({
        collectPayment: 3,
        splits: [
          { mode: "Cash", amount: 1 },
          { mode: "Card", amount: 1 },
          { mode: "UPI", amount: 1 },
        ],
      })
    ).toThrow();
  });
});

describe("bill collectPaymentSchema — splits", () => {
  it("keeps splits on the parsed output", () => {
    const parsed = billCollectPaymentSchema.parse({ amount: 1000, splits: twoSplits });
    expect(parsed.splits).toEqual(twoSplits);
  });

  it("still accepts a legacy collection with no splits", () => {
    const parsed = billCollectPaymentSchema.parse({ amount: 300, paymentMode: "UPI" });
    expect(parsed.amount).toBe(300);
    expect(parsed.paymentMode).toBe("UPI");
  });

  it("rejects a third split row", () => {
    expect(() =>
      billCollectPaymentSchema.parse({
        amount: 3,
        splits: [
          { mode: "Cash", amount: 1 },
          { mode: "Card", amount: 1 },
          { mode: "UPI", amount: 1 },
        ],
      })
    ).toThrow();
  });

  it("rejects an invalid mode inside splits", () => {
    expect(() =>
      billCollectPaymentSchema.parse({ amount: 1, splits: [{ mode: "Bitcoin", amount: 1 }] })
    ).toThrow();
  });
});
