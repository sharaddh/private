import { z } from "zod";
import { VALID_PAYMENT_MODES } from "../types";
import { MAX_SPLIT_ROWS } from "../services/paymentSplits";

/**
 * One tender row of a split collection. `mode` is checked against the canonical
 * list because `splits` is a new field with no legacy values to preserve; the
 * single-mode `paymentMode`/`mode` fields stay permissive for backward
 * compatibility (see normalizeSplits).
 */
export const splitRowSchema = z.object({
  mode: z.enum(
    VALID_PAYMENT_MODES,
    `Payment mode must be one of: ${VALID_PAYMENT_MODES.join(", ")}`
  ),
  amount: z.number().min(0, "Split amount cannot be negative"),
});

/** At most two modes per collection. Mirrors normalizeSplits' own check. */
export const splitsSchema = z.array(splitRowSchema).max(
  MAX_SPLIT_ROWS,
  `A collection can be split across at most ${MAX_SPLIT_ROWS} payment modes`
);

export const createPaymentSchema = z.object({
  customerId: z.string().min(1),
  billId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be positive"),
  paymentMode: z.enum(VALID_PAYMENT_MODES).optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePaymentSchema = z
  .object({
    customerId: z.string().optional(),
    billId: z.string().optional(),
    amount: z.number().min(0.01).optional(),
    paymentMode: z.enum(VALID_PAYMENT_MODES).optional(),
    paymentDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();
