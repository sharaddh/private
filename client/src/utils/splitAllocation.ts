import type { CanonicalPaymentMode } from '../constants/paymentModes';

/**
 * One tender row in the split editor. `mode` is kept as a plain `string` because
 * two of the five screens are not restricted to the canonical list at compile
 * time and the legacy `PaymentMode` union still carries Hindi aliases. Use
 * `isCanonicalPaymentMode` before putting a row on the wire.
 */
export interface SplitRow {
  mode: string;
  amount: number;
}

/** At most two modes per collection. Mirrors `MAX_SPLIT_ROWS` on the server. */
export const MAX_SPLIT_ROWS = 2;

/** The default single-row draft every screen starts from. */
export function singleRow(mode: string = 'Cash', amount: number = 0): SplitRow[] {
  return [{ mode, amount }];
}

/** Drop rows left at zero — they are not tenders, and the server drops them too. */
export function nonZeroRows(rows: SplitRow[]): SplitRow[] {
  return rows.filter((r) => Number.isFinite(r.amount) && r.amount > 0);
}

/** Sum of the rows. The single figure every downstream total is derived from. */
export function splitTotal(rows: SplitRow[]): number {
  return rows.reduce((sum, r) => (Number.isFinite(r.amount) ? sum + r.amount : sum), 0);
}

/** The primary tender — what the legacy single-mode field carries. */
export function primaryRow(rows: SplitRow[]): SplitRow {
  return rows[0] ?? { mode: 'Cash', amount: 0 };
}

/**
 * True only when this is a *real* split: at least two non-zero rows.
 *
 * This distinction is load-bearing. The server sets `usedSplits` as soon as
 * `splits` carries one positive row, and on that path every site 400s an
 * over-allocation instead of silently capping it. Sending a one-row `splits`
 * array would therefore turn every over-typed single-mode collection that works
 * today into a hard error. One row must keep using the legacy fields.
 */
export function isSplitActive(rows: SplitRow[]): boolean {
  return nonZeroRows(rows).length > 1;
}

/**
 * The over-allocation guard. Only meaningful for a real split — the legacy path
 * keeps its historical behaviour on every site (two of them cap silently, one
 * never capped), and the user asked for that not to change.
 */
export function isOverAllocated(rows: SplitRow[], collectable: number): boolean {
  return isSplitActive(rows) && splitTotal(rows) > collectable;
}

export interface Allocation {
  /** Sum of the non-zero rows. */
  total: number;
  /** What is still due after this collection. Never negative. */
  remaining: number;
  over: boolean;
  /** Whether more than one non-zero row is in play. */
  split: boolean;
}

/** The live readout the split editor shows under its rows. */
export function allocation(rows: SplitRow[], collectable: number): Allocation {
  const total = splitTotal(rows);
  return {
    total,
    remaining: Math.max(0, collectable - total),
    over: isOverAllocated(rows, collectable),
    split: isSplitActive(rows),
  };
}

/**
 * What a screen puts on the wire for the payment.
 *
 * `amount`/`collectPayment` is ALWAYS the split total, never row 1 alone. That
 * is the safety net for the silent-strip case: three of the four write sites use
 * a plain `z.object`, so a server that does not know the `splits` key drops it
 * silently rather than 400ing. If the legacy amount carries the full sum, a
 * stripped split degrades to a correct single-mode total instead of a wrong one.
 */
export interface PaymentPayload {
  amount?: number;
  collectPayment?: number;
  mode?: string;
  paymentMode?: string;
  splits?: Array<{ mode: CanonicalPaymentMode; amount: number }>;
}

export interface BuildPayloadOptions {
  rows: SplitRow[];
  /** Which legacy field name this endpoint uses for the amount. */
  amountField: 'amount' | 'collectPayment';
  /** Which legacy field name this endpoint uses for the mode. */
  modeField: 'mode' | 'paymentMode';
  /** Only rows whose mode passes this guard are allowed on the wire. */
  isModeAllowed?: (mode: string) => boolean;
}

/**
 * Build the payment body for any of the four write sites.
 *
 * `splits` is attached only for a genuine two-mode split. A single row produces
 * exactly the payload the screen sent before this feature existed.
 */
export function buildPaymentPayload({
  rows,
  amountField,
  modeField,
  isModeAllowed,
}: BuildPayloadOptions): PaymentPayload {
  const total = splitTotal(rows);
  const primary = primaryRow(rows);

  const payload: PaymentPayload = {
    [amountField]: total,
    [modeField]: primary.mode,
  } as PaymentPayload;

  if (!isSplitActive(rows)) return payload;

  const allowed = isModeAllowed ?? (() => true);
  const splits = nonZeroRows(rows)
    .filter((r) => allowed(r.mode))
    .map((r) => ({ mode: r.mode as CanonicalPaymentMode, amount: r.amount }));

  // A split whose modes the endpoint will not accept must not silently degrade
  // to a one-mode payment carrying the whole total. Refuse instead.
  if (splits.length !== nonZeroRows(rows).length) {
    throw new Error('Split contains a mode this payment point does not offer');
  }

  payload.splits = splits;
  return payload;
}
