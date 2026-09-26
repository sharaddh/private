import { AppError } from "../middleware/errorHandler";
import { VALID_PAYMENT_MODES } from "../types";
import type { Prisma } from "@prisma/client";

/** A single tender: one payment row. */
export interface PaymentSplit {
  mode: string;
  amount: number;
}

export interface NormalizedSplits {
  /** Rows to write, zero-amount rows already dropped. Empty means "no tender". */
  rows: PaymentSplit[];
  /** Sum of `rows`. */
  total: number;
  /**
   * True when the `splits` array drove the result. Callers use this to pick the
   * validation rule: the split path rejects an over-allocation, the legacy
   * single-mode path keeps its historical behaviour.
   */
  usedSplits: boolean;
}

/** Anything a client might send in place of a payment. All fields optional. */
export interface SplitPaymentInput {
  splits?: unknown;
  /** Legacy amount. Workspace uses `amount`; bills use `amount`; orders use `collectPayment`. */
  amount?: unknown;
  /** Legacy amount under the orders field name. */
  collectPayment?: unknown;
  /** Legacy mode under the bills/orders field name. */
  paymentMode?: unknown;
  /** Legacy mode under the workspace field name. */
  mode?: unknown;
}

export const MAX_SPLIT_ROWS = 2;

const VALID_MODE_SET = new Set<string>(VALID_PAYMENT_MODES);

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

/**
 * Turn a request's payment fields into the rows that should become `Payment`
 * records.
 *
 * `splits` wins when it carries at least one positive row; otherwise the legacy
 * single-mode fields are used, so an un-updated client — or a server that
 * stripped `splits` — still records the right total in the right mode.
 *
 * The legacy mode is deliberately NOT validated: `Payment.paymentMode` is a
 * plain `String` column with no enum constraint, and the client type still
 * carries legacy Hindi aliases. Rejecting them would fail writes that succeed
 * today. Only `splits` rows, which are new, are checked against the valid modes.
 */
export function normalizeSplits(input: SplitPaymentInput | undefined | null): NormalizedSplits {
  const legacyMode = firstString(input?.paymentMode, input?.mode) ?? "Cash";

  if (input?.splits !== undefined && input?.splits !== null) {
    if (!Array.isArray(input.splits)) {
      throw new AppError(400, "Payment splits must be an array");
    }
    if (input.splits.length > MAX_SPLIT_ROWS) {
      throw new AppError(
        400,
        `Payment supports at most ${MAX_SPLIT_ROWS} modes per collection`
      );
    }

    const rows: PaymentSplit[] = [];
    for (const raw of input.splits) {
      if (raw === null || typeof raw !== "object") {
        throw new AppError(400, "Each payment split must be an object");
      }
      const row = raw as Record<string, unknown>;
      const mode = row.mode;
      if (typeof mode !== "string" || !VALID_MODE_SET.has(mode)) {
        throw new AppError(
          400,
          `Invalid payment mode "${String(mode)}". Expected one of: ${VALID_PAYMENT_MODES.join(", ")}`
        );
      }
      const amount = toFiniteNumber(row.amount);
      if (Number.isNaN(amount) || amount < 0) {
        throw new AppError(400, "Each payment split needs a non-negative amount");
      }
      // A second row left at 0 is not a tender; drop it rather than write it.
      if (amount === 0) continue;
      rows.push({ mode, amount });
    }

    if (rows.length > 0) {
      return { rows, total: sumOf(rows), usedSplits: true };
    }
    // Every row was zero — nothing was actually split, so the legacy fields stand.
  }

  const legacyAmount = toFiniteNumber(input?.amount ?? input?.collectPayment);
  const amount = Number.isNaN(legacyAmount) || legacyAmount <= 0 ? 0 : legacyAmount;
  if (amount === 0) {
    return { rows: [], total: 0, usedSplits: false };
  }
  return { rows: [{ mode: legacyMode, amount }], total: amount, usedSplits: false };
}

function sumOf(rows: PaymentSplit[]): number {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

export type PaymentDb = Prisma.TransactionClient;

export interface RecordPaymentsInput {
  customerId: string;
  billId: string;
  rows: PaymentSplit[];
  /** Same note on every row, matching the text each site writes today. */
  notes?: string;
  paymentDate?: Date;
  /**
   * Required: a raw `tx` delegate is not wrapped by `scoped()`, so unlike the
   * global models it does not inject the branch itself.
   */
  branchId: string;
}

export interface RecordPaymentsResult {
  payments: Array<Record<string, unknown>>;
  total: number;
}

/**
 * Insert one `Payment` row per split inside the caller's transaction and return
 * the summed total. The caller keeps driving `advancePaid` and
 * `customer.pendingAmount` from that total, so the arithmetic is identical
 * whatever the row count.
 */
export async function recordPayments(
  db: PaymentDb,
  input: RecordPaymentsInput
): Promise<RecordPaymentsResult> {
  const { customerId, billId, rows, notes, branchId } = input;
  if (!rows.length) {
    return { payments: [], total: 0 };
  }

  const paymentDate = input.paymentDate ?? new Date();
  const payments: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const created = await db.payment.create({
      data: {
        customerId,
        billId,
        amount: row.amount,
        paymentMode: row.mode,
        paymentDate,
        notes,
        branchId,
      },
    });
    payments.push(created as unknown as Record<string, unknown>);
  }

  return { payments, total: sumOf(rows) };
}
