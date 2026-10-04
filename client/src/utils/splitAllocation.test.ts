import { describe, expect, it } from 'vitest';
import { isCanonicalPaymentMode } from '../constants/paymentModes';
import {
  allocation,
  buildPaymentPayload,
  isOverAllocated,
  isSplitActive,
  MAX_SPLIT_ROWS,
  nonZeroRows,
  primaryRow,
  singleRow,
  splitTotal,
  type SplitRow,
} from './splitAllocation';

const opts = {
  amountField: 'amount',
  modeField: 'mode',
} as const;

describe('nonZeroRows', () => {
  it('drops rows left at zero — they are not tenders', () => {
    expect(nonZeroRows([{ mode: 'Cash', amount: 500 }, { mode: 'Card', amount: 0 }])).toEqual([
      { mode: 'Cash', amount: 500 },
    ]);
  });

  it('drops negative and non-finite amounts', () => {
    expect(
      nonZeroRows([
        { mode: 'Cash', amount: -5 },
        { mode: 'Card', amount: NaN },
        { mode: 'UPI', amount: 100 },
      ])
    ).toEqual([{ mode: 'UPI', amount: 100 }]);
  });
});

describe('splitTotal', () => {
  it('sums every row, zero rows included', () => {
    expect(splitTotal([{ mode: 'Cash', amount: 500 }, { mode: 'Card', amount: 300 }])).toBe(800);
  });

  it('is zero for an empty draft', () => {
    expect(splitTotal([])).toBe(0);
  });

  it('ignores a non-finite amount rather than poisoning the total with NaN', () => {
    expect(splitTotal([{ mode: 'Cash', amount: 500 }, { mode: 'Card', amount: NaN }])).toBe(500);
  });
});

describe('isSplitActive', () => {
  it('is false for a single non-zero row, so the legacy path is kept', () => {
    // Load-bearing: a one-row `splits` array would make every over-typed
    // single-mode collection a hard 400 instead of today's behaviour.
    expect(isSplitActive([{ mode: 'Cash', amount: 800 }])).toBe(false);
  });

  it('is false when the second row is still zero', () => {
    expect(isSplitActive([{ mode: 'Cash', amount: 800 }, { mode: 'Card', amount: 0 }])).toBe(false);
  });

  it('is true once two rows both carry an amount', () => {
    expect(isSplitActive([{ mode: 'Cash', amount: 500 }, { mode: 'Card', amount: 300 }])).toBe(true);
  });

  it('allows the same mode in both rows', () => {
    expect(isSplitActive([{ mode: 'Cash', amount: 500 }, { mode: 'Cash', amount: 300 }])).toBe(true);
  });
});

describe('isOverAllocated', () => {
  it('ignores a single over-typed row — legacy sites cap or not-cap on their own terms', () => {
    expect(isOverAllocated([{ mode: 'Cash', amount: 900 }], 500)).toBe(false);
  });

  it('flags a split that exceeds the collectable amount', () => {
    expect(isOverAllocated([{ mode: 'Cash', amount: 600 }, { mode: 'Card', amount: 300 }], 700)).toBe(
      true
    );
  });

  it('allows a split that exactly equals the collectable amount', () => {
    expect(isOverAllocated([{ mode: 'Cash', amount: 400 }, { mode: 'Card', amount: 300 }], 700)).toBe(
      false
    );
  });

  it('allows a deliberately under-allocated split', () => {
    expect(isOverAllocated([{ mode: 'Cash', amount: 400 }, { mode: 'Card', amount: 0 }], 700)).toBe(
      false
    );
  });
});

describe('allocation', () => {
  it('reports the remainder still due', () => {
    expect(allocation([{ mode: 'Cash', amount: 400 }, { mode: 'Card', amount: 300 }], 1000)).toEqual(
      { total: 700, remaining: 300, over: false, split: true }
    );
  });

  it('never reports a negative remainder on an over-allocation', () => {
    expect(allocation([{ mode: 'Cash', amount: 800 }, { mode: 'Card', amount: 400 }], 1000)).toEqual(
      { total: 1200, remaining: 0, over: true, split: true }
    );
  });

  it('treats the untouched default draft as no tender at all', () => {
    expect(allocation(singleRow(), 1000)).toEqual({
      total: 0,
      remaining: 1000,
      over: false,
      split: false,
    });
  });
});

describe('primaryRow', () => {
  it('is the first row — what the legacy mode field carries', () => {
    const rows: SplitRow[] = [
      { mode: 'UPI', amount: 300 },
      { mode: 'Cash', amount: 700 },
    ];
    expect(primaryRow(rows).mode).toBe('UPI');
  });

  it('falls back to Cash on an empty draft rather than throwing', () => {
    expect(primaryRow([])).toEqual({ mode: 'Cash', amount: 0 });
  });
});

describe('buildPaymentPayload', () => {
  it('emits exactly the legacy payload for a single row', () => {
    expect(buildPaymentPayload({ rows: singleRow('Card', 800), ...opts })).toEqual({
      amount: 800,
      mode: 'Card',
    });
  });

  it('omits `splits` when the second row is still zero', () => {
    const rows: SplitRow[] = [
      { mode: 'Cash', amount: 800 },
      { mode: 'Card', amount: 0 },
    ];
    expect(buildPaymentPayload({ rows, ...opts })).toEqual({ amount: 800, mode: 'Cash' });
  });

  it('puts the FULL split total in the legacy amount, not row 1 alone', () => {
    // The safety net: three of the four write sites use a plain z.object, so a
    // server that drops the unknown `splits` key must still record 800.
    const rows: SplitRow[] = [
      { mode: 'Cash', amount: 500 },
      { mode: 'Card', amount: 300 },
    ];
    const payload = buildPaymentPayload({ rows, ...opts });
    expect(payload.amount).toBe(800);
    expect(payload.mode).toBe('Cash');
    expect(payload.splits).toEqual([
      { mode: 'Cash', amount: 500 },
      { mode: 'Card', amount: 300 },
    ]);
  });

  it('honours the collect-payment field names', () => {
    const rows: SplitRow[] = [
      { mode: 'Cash', amount: 500 },
      { mode: 'UPI', amount: 300 },
    ];
    const payload = buildPaymentPayload({
      rows,
      amountField: 'collectPayment',
      modeField: 'paymentMode',
    });
    expect(payload.collectPayment).toBe(800);
    expect(payload.paymentMode).toBe('Cash');
    expect(payload.amount).toBeUndefined();
  });

  it('refuses a split containing a mode the endpoint does not offer', () => {
    // Must not silently degrade to a one-mode payment carrying the whole total.
    const rows: SplitRow[] = [
      { mode: 'Cash', amount: 500 },
      { mode: 'Insurance', amount: 300 },
    ];
    expect(() =>
      buildPaymentPayload({ rows, ...opts, isModeAllowed: isCanonicalPaymentMode })
    ).not.toThrow();
    expect(() =>
      buildPaymentPayload({ rows, ...opts, isModeAllowed: (m) => m !== 'Insurance' })
    ).toThrow(/does not offer/);
  });

  it('caps a draft at two rows', () => {
    expect(MAX_SPLIT_ROWS).toBe(2);
  });
});
