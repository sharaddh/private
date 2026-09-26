import { describe, it, expect } from "vitest";
import { normalizeSplits, recordPayments, MAX_SPLIT_ROWS } from "./paymentSplits";
import type { PaymentDb } from "./paymentSplits";
import { AppError } from "../middleware/errorHandler";

interface FakeRow extends Record<string, unknown> {
  id: string;
}

/** A stand-in for a Prisma transaction client that just records what it was asked to insert. */
function fakeTx() {
  const created: FakeRow[] = [];
  const db = {
    created,
    payment: {
      create: async ({ data }: { data: FakeRow }) => {
        const row = { id: `pay_${created.length + 1}`, ...data };
        created.push(row);
        return row;
      },
    },
  };
  return db as typeof db & PaymentDb;
}

function expectAppError(fn: () => unknown, status: number, messageMatch?: RegExp) {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(AppError);
  const err = thrown as AppError;
  expect(err.statusCode).toBe(status);
  if (messageMatch) expect(err.message).toMatch(messageMatch);
}

describe("normalizeSplits — legacy single-mode fallback", () => {
  it("falls back to amount/mode from the workspace payload", () => {
    const r = normalizeSplits({ amount: 500, mode: "Card" });
    expect(r.rows).toEqual([{ mode: "Card", amount: 500 }]);
    expect(r.total).toBe(500);
    expect(r.usedSplits).toBe(false);
  });

  it("falls back to amount/paymentMode from the bills payload", () => {
    const r = normalizeSplits({ amount: 250, paymentMode: "UPI" });
    expect(r.rows).toEqual([{ mode: "UPI", amount: 250 }]);
    expect(r.usedSplits).toBe(false);
  });

  it("falls back to collectPayment/paymentMode from the orders payload", () => {
    const r = normalizeSplits({ collectPayment: 700, paymentMode: "Insurance" } as never);
    expect(r.rows).toEqual([{ mode: "Insurance", amount: 700 }]);
    expect(r.usedSplits).toBe(false);
  });

  it("prefers paymentMode over mode when both are present", () => {
    const r = normalizeSplits({ amount: 100, mode: "Cash", paymentMode: "Card" });
    expect(r.rows).toEqual([{ mode: "Card", amount: 100 }]);
  });

  it("defaults to Cash when no mode is supplied", () => {
    const r = normalizeSplits({ amount: 100 });
    expect(r.rows).toEqual([{ mode: "Cash", amount: 100 }]);
  });

  it("produces no rows for a zero legacy amount", () => {
    const r = normalizeSplits({ amount: 0, mode: "Card" });
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("produces no rows for a missing legacy amount", () => {
    const r = normalizeSplits({ mode: "Card" });
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("treats a non-numeric legacy amount as zero, matching today's `|| 0`", () => {
    const r = normalizeSplits({ amount: "not-a-number" as never, mode: "Card" });
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("tolerates a completely absent input object", () => {
    const r = normalizeSplits(undefined);
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.usedSplits).toBe(false);
  });

  it("passes a non-canonical legacy mode through unvalidated (regression guard)", () => {
    // paymentMode is a plain String column with no enum constraint, and the
    // client type still carries legacy Hindi aliases. Rejecting them here
    // would break a write that succeeds today.
    const r = normalizeSplits({ amount: 100, mode: "नकद" });
    expect(r.rows).toEqual([{ mode: "नकद", amount: 100 }]);
  });
});

describe("normalizeSplits — splits path", () => {
  it("uses splits when at least one row has a positive amount", () => {
    const r = normalizeSplits({
      amount: 1000,
      mode: "Cash",
      splits: [
        { mode: "Cash", amount: 500 },
        { mode: "Card", amount: 500 },
      ],
    });
    expect(r.rows).toEqual([
      { mode: "Cash", amount: 500 },
      { mode: "Card", amount: 500 },
    ]);
    expect(r.total).toBe(1000);
    expect(r.usedSplits).toBe(true);
  });

  it("takes precedence over the legacy fields", () => {
    const r = normalizeSplits({
      amount: 999,
      mode: "Insurance",
      splits: [{ mode: "UPI", amount: 250 }],
    });
    expect(r.rows).toEqual([{ mode: "UPI", amount: 250 }]);
    expect(r.total).toBe(250);
  });

  it("accepts a single-row splits array and still reports usedSplits", () => {
    const r = normalizeSplits({ splits: [{ mode: "UPI", amount: 120 }] });
    expect(r.rows).toEqual([{ mode: "UPI", amount: 120 }]);
    expect(r.usedSplits).toBe(true);
  });

  it("drops zero-amount rows instead of writing them", () => {
    const r = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 500 },
        { mode: "Card", amount: 0 },
      ],
    });
    expect(r.rows).toEqual([{ mode: "Cash", amount: 500 }]);
    expect(r.total).toBe(500);
    expect(r.usedSplits).toBe(true);
  });

  it("allows the same mode in both rows", () => {
    const r = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 300 },
        { mode: "Cash", amount: 200 },
      ],
    });
    expect(r.rows).toHaveLength(2);
    expect(r.total).toBe(500);
  });

  it("supports arbitrary amounts, not just halves", () => {
    const r = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 137.5 },
        { mode: "Card", amount: 62.5 },
      ],
    });
    expect(r.total).toBe(200);
  });

  it("falls back to legacy when every splits row is zero", () => {
    const r = normalizeSplits({
      amount: 400,
      mode: "Card",
      splits: [
        { mode: "Cash", amount: 0 },
        { mode: "UPI", amount: 0 },
      ],
    });
    expect(r.rows).toEqual([{ mode: "Card", amount: 400 }]);
    expect(r.usedSplits).toBe(false);
  });

  it("falls back to legacy when splits is an empty array", () => {
    const r = normalizeSplits({ amount: 400, mode: "Card", splits: [] });
    expect(r.rows).toEqual([{ mode: "Card", amount: 400 }]);
    expect(r.usedSplits).toBe(false);
  });
});

describe("normalizeSplits — validation", () => {
  it("rejects more than two submitted rows", () => {
    expectAppError(
      () =>
        normalizeSplits({
          splits: [
            { mode: "Cash", amount: 1 },
            { mode: "Card", amount: 1 },
            { mode: "UPI", amount: 1 },
          ],
        }),
      400,
      /two|2/i
    );
  });

  it("rejects three rows even when one is zero", () => {
    expect(MAX_SPLIT_ROWS).toBe(2);
    expectAppError(
      () =>
        normalizeSplits({
          splits: [
            { mode: "Cash", amount: 100 },
            { mode: "Card", amount: 0 },
            { mode: "UPI", amount: 50 },
          ],
        }),
      400
    );
  });

  it("rejects an unknown mode inside splits", () => {
    expectAppError(
      () => normalizeSplits({ splits: [{ mode: "Bitcoin", amount: 100 }] }),
      400,
      /mode/i
    );
  });

  it("rejects a non-canonical Hindi mode inside splits", () => {
    expectAppError(
      () => normalizeSplits({ splits: [{ mode: "नकद", amount: 100 }] }),
      400
    );
  });

  it("rejects a missing mode inside splits", () => {
    expectAppError(
      () => normalizeSplits({ splits: [{ amount: 100 }] as never }),
      400,
      /mode/i
    );
  });

  it("rejects a negative amount inside splits", () => {
    expectAppError(
      () => normalizeSplits({ splits: [{ mode: "Cash", amount: -50 }] }),
      400,
      /amount/i
    );
  });

  it("rejects a non-numeric amount inside splits", () => {
    expectAppError(
      () => normalizeSplits({ splits: [{ mode: "Cash", amount: "abc" as never }] }),
      400,
      /amount/i
    );
  });

  it("rejects a splits value that is not an array", () => {
    expectAppError(() => normalizeSplits({ splits: "Cash" as never }), 400);
    expectAppError(() => normalizeSplits({ splits: 42 as never }), 400);
    expectAppError(() => normalizeSplits({ splits: { mode: "Cash" } as never }), 400);
  });

  it("rejects a null row inside splits", () => {
    expectAppError(() => normalizeSplits({ splits: [null] as never }), 400);
  });
});

describe("recordPayments", () => {
  const base = {
    customerId: "cust_1",
    billId: "bill_1",
    branchId: "branch_1",
  };

  it("inserts one row per split, in order", async () => {
    const db = fakeTx();
    const res = await recordPayments(db, {
      ...base,
      rows: [
        { mode: "Cash", amount: 500 },
        { mode: "Card", amount: 500 },
      ],
    });

    expect(db.created).toHaveLength(2);
    expect(db.created.map((r) => r.paymentMode)).toEqual(["Cash", "Card"]);
    expect(db.created.map((r) => r.amount)).toEqual([500, 500]);
    expect(res.total).toBe(1000);
    expect(res.payments).toHaveLength(2);
  });

  it("stamps every row with the customer, bill, branch and note", async () => {
    const db = fakeTx();
    const paymentDate = new Date("2026-09-26T00:00:00.000Z");
    await recordPayments(db, {
      ...base,
      rows: [
        { mode: "Cash", amount: 100 },
        { mode: "UPI", amount: 200 },
      ],
      notes: "Advance payment",
      paymentDate,
    });

    for (const row of db.created) {
      expect(row.customerId).toBe("cust_1");
      expect(row.billId).toBe("bill_1");
      expect(row.branchId).toBe("branch_1");
      expect(row.notes).toBe("Advance payment");
      expect(row.paymentDate).toBe(paymentDate);
    }
  });

  it("defaults paymentDate when the caller does not supply one", async () => {
    const db = fakeTx();
    const before = Date.now();
    await recordPayments(db, { ...base, rows: [{ mode: "Cash", amount: 10 }] });
    const stamped = db.created[0].paymentDate as Date;
    expect(stamped).toBeInstanceOf(Date);
    expect(stamped.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("writes a single row for a single-row split", async () => {
    const db = fakeTx();
    const res = await recordPayments(db, { ...base, rows: [{ mode: "Cash", amount: 250 }] });
    expect(db.created).toHaveLength(1);
    expect(res.total).toBe(250);
  });

  it("inserts nothing and totals zero for an empty row list", async () => {
    const db = fakeTx();
    const res = await recordPayments(db, { ...base, rows: [] });
    expect(db.created).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.payments).toEqual([]);
  });

  it("returns the same total the rows sum to, for fractional amounts", async () => {
    const db = fakeTx();
    const res = await recordPayments(db, {
      ...base,
      rows: [
        { mode: "Cash", amount: 33.33 },
        { mode: "Card", amount: 66.67 },
      ],
    });
    expect(res.total).toBeCloseTo(100, 6);
  });

  it("does not mutate the caller's row objects", async () => {
    const db = fakeTx();
    const rows = [
      { mode: "Cash", amount: 500 },
      { mode: "Card", amount: 500 },
    ];
    const snapshot = JSON.stringify(rows);
    await recordPayments(db, { ...base, rows });
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});
