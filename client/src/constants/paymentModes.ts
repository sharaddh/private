/**
 * The canonical payment modes, mirroring `VALID_PAYMENT_MODES` on the server.
 *
 * This is deliberately *not* the `PaymentMode` type in `types/index.ts`: that
 * union still carries four legacy Hindi aliases and is missing one value the
 * visit form actually sends. `splits` rows are new, so they get a clean type
 * that matches what the server will accept.
 */
export type CanonicalPaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Insurance';

export const CANONICAL_PAYMENT_MODES: CanonicalPaymentMode[] = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Insurance',
];

export function isCanonicalPaymentMode(value: unknown): value is CanonicalPaymentMode {
  return typeof value === 'string' && (CANONICAL_PAYMENT_MODES as string[]).includes(value);
}
