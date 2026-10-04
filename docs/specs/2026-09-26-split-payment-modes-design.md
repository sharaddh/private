# Design: Split payment across two modes

- Date: 2026-09-26
- Status: Draft — pending user review
- Scope: `client/` (React) + `server/` (Express + Prisma)
- Relates to: `server/src/services/dashboard.service.ts` (branch-scoped, see §9)

## 1. Goal

Let staff record that a single collection was tendered in **two different modes** — the
common optical-shop case of "half cash, half card" — at **every** point where a payment is
taken, instead of forcing one mode per payment.

## 2. Requirements (from clarifying Q&A)

1. **Exactly two modes**, amounts arbitrary. No third row, no "split in half" shortcut button.
2. **Any two of the five existing modes** — `Cash`, `UPI`, `Card`, `Bank Transfer`,
   `Insurance`. No new modes, so receipts, the dashboard mode-split chart, and
   `translatePaymentMode` keep working unchanged.
3. **Under-allocation is allowed.** The split describes *how* the collected amount was
   tendered; it does not change what is owed. Any unallocated remainder stays in
   `pendingAmount`.
4. **Scope — every live screen that takes a payment**, at billing time and for later
   collections. That is **five screens**: `Workspace` (covers both billing and direct
   sell / walk-in), `NewVisit`, `CustomerNewVisit`, `CollectPayment`, and `Pickup`
   (which has two delivery branches, §6.2). These map to the **four** server write
   sites in §6.2.

## 3. Assumed decisions (defaults taken, user to confirm)

- **Over-allocation on the split path is rejected, not truncated.** A split totalling more
  than the collectable amount returns 400 and blocks submit. Silent truncation would let
  staff believe ₹800 was collected when ₹500 was recorded — a reconciliation hazard worse
  than an error message. Under-allocation stays allowed (req 3), so the two rules are
  deliberately asymmetric.
- **The legacy single-mode path keeps its existing cap.** Sites 2 and 4 today do
  `Math.min(amount, pendingAmount)`, silently collecting the pending amount when staff
  over-types. That behaviour is **not** changed — changing cap-to-reject on a
  single-mode payment could break staff who rely on it. The consequence is a deliberate
  asymmetry: `splits` rejects loudly, legacy single-mode still caps silently. Recorded
  here so it is a decision, not an oversight.
- **Zero-amount rows are dropped, not written.** A second row left at 0 contributes
  nothing; the client also greys it out so it is not mistaken for a real tender.
- **The same mode may appear in both rows** (e.g. Cash + Cash). Not blocked; the rows
  aggregate in the mode-split chart, which is the correct report.
- **Default UI is unchanged.** One mode + one amount, exactly as today. The second row is
  opt-in, so staff who never split see no change.
- **Legacy single-mode fields stay supported.** `payment: { amount, mode }` keeps working
  so any un-updated client, script, or warehouse caller is unaffected.

## 4. Data model — no migration

`Payment` is already **one row per tender**, and `Bill.payments` is a list
(`schema.prisma:291`). `Bill.advancePaid` is a denormalised running total of all payment
rows, not a mode-bearing field. A two-mode payment is therefore *already storable* — the
gap is entirely in the input path, which is single-mode today.

**No schema change. No migration.** The mode-split dashboard chart
(`dashboard.service.ts:275 groupPaymentsByMode`) will start reporting the split correctly
with no change to that code.

## 5. API contract

Add an optional `splits` array; keep the existing fields.

```ts
// POST /api/workspace  (advance at billing)
payment: {
  amount?: number,        // legacy single mode — still honoured
  mode?: string,          // legacy single mode — still honoured
  notes?: string,
  splits?: Array<{ mode: PaymentMode; amount: number }>,  // NEW, max 2
}

// POST /api/bills/:id/collect-payment
// PATCH /api/orders/:id/collect-payment
{ amount | collectPayment: number, paymentMode?: string, splits?: [...] }  // NEW: splits

// PATCH /api/orders/:id/status
{ status, collectPayment?, paymentMode?, splits?: [...] }                  // NEW: splits
```

Server-side normalisation, applied once per request:

1. If `splits` has ≥1 row with `amount > 0` → use those rows.
2. Otherwise fall back to the legacy `amount`/`mode` (or `collectPayment`/`paymentMode`).

The client's single-row default is just case 2, so there is one code path, not two.

## 6. Server changes

### 6.1 One shared helper

Split logic must not be pasted into four call sites. Add to `server/src/services/payment.service.ts`:

```ts
normalizeSplits(input): Array<{ mode: string; amount: number }>
// → legacy fallback, drops zero rows, caps length at 2

recordPayments(tx, { customerId, billId, splits, notesPrefix, paymentDate, branchId })
// → inserts one Payment row per split inside the CALLER's transaction,
//   returns the summed total
```

`advancePaid` and `customer.pendingAmount` continue to be driven by the **returned
total**, so the arithmetic is identical to today regardless of row count.

### 6.2 The four live write sites

| # | File:line | Endpoint | In tx? | Caps at pending? |
|---|---|---|---|---|
| 1 | `services/workspace.service.ts:220` | `POST /api/workspace` | yes | n/a (new bill) |
| 2 | `services/bill.service.ts:280` | `POST /api/bills/:id/collect-payment` | yes | yes |
| 3 | `routes/orders.ts:195` | `PATCH /api/orders/:id/status` | **no** | **no** |
| 4 | `routes/orders.ts:270` | `PATCH /api/orders/:id/collect-payment` | **no** | yes |

Sites 1 and 2 are already transactional — swap the single `create` for `recordPayments`.
Sites 3 and 4 are **inline route handlers that are not in a transaction** (confirmed:
`routes/orders.ts` never imports `order.service`). Each currently performs
`Payment.create` → `Bill.update` → `Customer.update` as three independent awaits, so a
failure part-way leaves a payment row with an unreduced balance.

**In scope (approved):** wrap sites 3 and 4 in a transaction, matching the pattern at
site 2, and route both through `recordPayments`.

### 6.3 Validation

- `splits`: array, **max 2** entries
- each `mode` ∈ `VALID_PAYMENT_MODES`; each `amount` ≥ 0
- zero-amount rows dropped before the total is validated

Total rules, per site — these differ on purpose, see §3:

| Site | Legacy single-mode | `splits` path |
|---|---|---|
| 1 `workspace` | unchanged | sum ≤ bill total, else 400 |
| 2 `bill.service` | unchanged (`Math.min` cap) | sum ≤ `bill.pendingAmount`, else 400 |
| 3 `orders.ts:195` | unchanged (**no cap** — §10) | sum ≤ `bill.pendingAmount`, else 400 |
| 4 `orders.ts:270` | unchanged (`Math.min` cap) | sum ≤ `bill.pendingAmount`, else 400 |

Note site 3: adding the split-path cap there means a **split** can no longer overpay even
though a single-mode payment still can. That inconsistency is inherited from §10 and is
not resolved here.

## 7. Client changes

### 7.1 New shared component

`client/src/components/SplitPaymentInput.tsx`

- Props: `splits`, `onChange`, `max` (collectable), `disabled`
- Renders the current mode selector + amount for row 1, a `+ Split` affordance, and
  conditionally row 2 (mode + amount)
- Live readout: `Allocated ₹700 of ₹1,000`, with the remainder shown as still due
- Over-allocation: inline error, submit blocked

### 7.2 Wiring

| Screen | File | Change |
|---|---|---|
| Billing / direct sell | `pages/Workspace.tsx` | `PaymentPanel` consumer |
| New visit | `pages/NewVisit.tsx` | inline payment block |
| New visit (customer) | `pages/CustomerNewVisit.tsx` | `PaymentPanel` consumer |
| Shared panel | `components/NewvistePage/PaymentPanel.tsx` | props `paymentMode`/`advancePaid` → `splits` |
| Confirmation | `components/NewvistePage/ConfirmationDashboard.tsx` | show 2-line breakdown |
| Collection | `pages/CollectPayment.tsx` | add component |
| Delivery | `pages/Pickup.tsx` | add component; feed **both** branches (§6.2 sites 3 and 4) |

`PaymentPanel`'s prop change is internal to the component; its 3 consumers must be
updated in the same change.

## 8. State coverage

| State | Behaviour |
|---|---|
| Single row (default) | Unchanged from today |
| Second row added, both 0 | No tender recorded; save behaves as today |
| Under-allocated | Allowed; remainder stays in `pendingAmount`, shown live |
| Fully allocated | Fully-paid styling, as today |
| Over-allocated (split) | Submit blocked inline **and** server 400s — never silently truncated |
| Second row = 0 | Row ignored; not written |
| Same mode both rows | Allowed; aggregates in mode-split chart |
| Submit fails | Field values preserved, error toast (no reset) |
| Slow network | Existing loading/disabled states retained |

## 9. Testing

Server, no DB required (same technique that caught the branch-scoping bug — mock the
delegate, assert the calls):

- `normalizeSplits` — legacy fallback, zero-row dropping, 2-row cap
- `recordPayments` — inserts N rows against a **fake tx**, returns the correct sum,
  inserts nothing when total is 0
- `collectPaymentSchema` / workspace schema — accepts `splits`, rejects >2 rows and
  bad modes
- Over-allocation returns 400 and writes no rows

Client:

- Extract the allocated/remaining math into a pure helper and unit-test it
- `tsc --noEmit` for both `client/` and `server/`

Manual, once a DB is available (none was running during this design):

- Split 500 cash + 500 card on a ₹1,000 bill → two `payments` rows, `advancePaid` 1000,
  `pendingAmount` 0, mode-split chart shows both
- Same split against a ₹700 pending bill → 400, nothing written
- Under-allocate 400 + 300 on ₹1,000 → `advancePaid` 700, `pendingAmount` 300
- Regression: a single-mode payment still produces exactly one row

## 10. Out of scope (deliberately not changing)

- **Dead code left untouched** (user decision): `services/order.service.ts:318
  updateOrderStatus` is unreachable — `routes/orders.ts` never imports `order.service`
  and implements the status transition inline — and `pages/CustomerNewVisit/` is an
  unrouted duplicate of `pages/CustomerNewVisit.tsx` (confirmed live by the absence of
  its "New Glasses" visit type in `client/dist/assets/*.js`). Both stay as-is. If either
  is ever wired up it will be single-mode; that is a known trap, not an oversight.
- **Overpay via delivery** (site 3 does not cap at `pendingAmount`, unlike sites 2 and 4)
  is a separate pre-existing bug. Reported, not fixed here.
- **The `x-branch-id` IDOR** — `middleware/branch.ts` trusts the client header without
  checking the user's assigned branches. Unrelated to this feature; still open from the
  2026-09-26 dashboard fix.

## 11. Files touched

**Server**
- `services/payment.service.ts` — `normalizeSplits`, `recordPayments`
- `validators/bill.validator.ts`, `validators/order.validator.ts`,
  `validators/workspace.validator.ts` — `splits` schema
- `services/workspace.service.ts`, `services/bill.service.ts`,
  `routes/orders.ts` (2 sites) — call the helper; wrap 3 & 4 in a transaction

**Client**
- `components/SplitPaymentInput.tsx` (new)
- `components/NewvistePage/PaymentPanel.tsx`,
  `components/NewvistePage/ConfirmationDashboard.tsx`
- `pages/Workspace.tsx`, `pages/NewVisit.tsx`, `pages/CustomerNewVisit.tsx`,
  `pages/CollectPayment.tsx`, `pages/Pickup.tsx`
