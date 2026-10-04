import { describe, it, expect } from "vitest";
import { normalizeSplits, MAX_SPLIT_ROWS } from "./paymentSplits";
import { AppError } from "../middleware/errorHandler";

/**
 * The per-site total rules from the design, exercised against the same helper
 * the routes use. Each rule is a pure function of the normalized split and the
 * collectable amount, so it is asserted directly rather than through a database.
 */

/** Site 1 (workspace billing): legacy unchanged, splits may not exceed the bill total. */
function billingRule(normalized: ReturnType<typeof normalizeSplits>, billTotal: number) {
  if (normalized.usedSplits && normalized.total > billTotal) {
    throw new AppError(400, "Collected more than the bill total");
  }
  return normalized.total;
}

/** Sites 2 and 4: legacy keeps its silent Math.min cap, splits may not exceed pending. */
function collectionRule(
  normalized: ReturnType<typeof normalizeSplits>,
  legacyAmount: number,
  pending: number
) {
  if (normalized.usedSplits) {
    if (normalized.total > pending) {
      throw new AppError(400, "Collected more than the pending amount");
    }
    return normalized.total;
  }
  return Math.min(legacyAmount, pending);
}

/** Site 3: legacy has never capped, splits still may not exceed pending. */
function deliveryRule(
  normalized: ReturnType<typeof normalizeSplits>,
  legacyAmount: number,
  pending: number
) {
  if (normalized.usedSplits) {
    if (normalized.total > pending) {
      throw new AppError(400, "Collected more than the pending amount");
    }
    return normalized.total;
  }
  return legacyAmount;
}

describe("billing rule (site 1)", () => {
  it("leaves a legacy advance payment exactly as it was", () => {
    const n = normalizeSplits({ amount: 400, mode: "Cash" });
    expect(billingRule(n, 1000)).toBe(400);
  });

  it("still lets a legacy advance exceed the bill total, as today", () => {
    const n = normalizeSplits({ amount: 1500, mode: "Cash" });
    expect(billingRule(n, 1000)).toBe(1500);
  });

  it("accepts a split that exactly covers the bill", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 500 },
        { mode: "Card", amount: 500 },
      ],
    });
    expect(billingRule(n, 1000)).toBe(1000);
  });

  it("accepts an under-allocated split and leaves the rest due", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 400 },
        { mode: "Card", amount: 300 },
      ],
    });
    expect(billingRule(n, 1000)).toBe(700);
  });

  it("rejects a split that exceeds the bill total", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 600 },
        { mode: "Card", amount: 600 },
      ],
    });
    expect(() => billingRule(n, 1000)).toThrow(AppError);
  });
});

describe("collection rule (sites 2 and 4)", () => {
  it("keeps the legacy silent cap unchanged", () => {
    const n = normalizeSplits({ amount: 900, paymentMode: "Cash" });
    expect(collectionRule(n, 900, 500)).toBe(500);
  });

  it("leaves an ordinary legacy collection alone", () => {
    const n = normalizeSplits({ amount: 300, paymentMode: "Card" });
    expect(collectionRule(n, 300, 500)).toBe(300);
  });

  it("accepts a split summing to exactly the pending amount", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 250 },
        { mode: "UPI", amount: 250 },
      ],
    });
    expect(collectionRule(n, 500, 500)).toBe(500);
  });

  it("accepts an under-allocated split", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 200 },
        { mode: "UPI", amount: 100 },
      ],
    });
    expect(collectionRule(n, 300, 500)).toBe(300);
  });

  it("rejects a split exceeding the pending amount instead of truncating it", () => {
    const n = normalizeSplits({
      splits: [
        { mode: "Cash", amount: 400 },
        { mode: "UPI", amount: 400 },
      ],
    });
    expect(() => collectionRule(n, 800, 500)).toThrow(AppError);
  });
});

describe("delivery rule (site 3)", () => {
  it("keeps the legacy no-cap behaviour unchanged", () => {
    const n = normalizeSplits({ collectPayment: 900, paymentMode: "Cash" });
    expect(deliveryRule(n, 900, 500)).toBe(900);
  });

  it("rejects a split exceeding the pending amount", () => {
    const n = normalizeSplits({
      collectPayment: 800,
      splits: [
        { mode: "Cash", amount: 400 },
        { mode: "Card", amount: 400 },
      ],
    });
    expect(() => deliveryRule(n, 800, 500)).toThrow(AppError);
  });

  it("accepts a split within the pending amount", () => {
    const n = normalizeSplits({
      collectPayment: 500,
      splits: [
        { mode: "Cash", amount: 200 },
        { mode: "Card", amount: 300 },
      ],
    });
    expect(deliveryRule(n, 500, 500)).toBe(500);
  });
});

describe("the cap is derived from the split sum, not the legacy field", () => {
  it("measures the split total, so a stale legacy amount cannot smuggle an overpay", () => {
    // The client sends collectPayment = split total. If a buggy client sent a
    // smaller legacy amount next to a larger split, the split is what counts.
    const n = normalizeSplits({
      collectPayment: 100,
      splits: [
        { mode: "Cash", amount: 400 },
        { mode: "Card", amount: 400 },
      ],
    });
    expect(() => collectionRule(n, 100, 500)).toThrow(AppError);
  });

  it("never lets the two-mode cap be bypassed by sending more rows", () => {
    expect(MAX_SPLIT_ROWS).toBe(2);
    expect(() =>
      normalizeSplits({
        splits: [
          { mode: "Cash", amount: 1 },
          { mode: "Card", amount: 1 },
          { mode: "UPI", amount: 1 },
        ],
      })
    ).toThrow(AppError);
  });
});
