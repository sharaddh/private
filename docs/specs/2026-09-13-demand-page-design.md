# Design: Dedicated Demand page for the Warehouse app

- Date: 2026-09-13
- Status: Draft — pending user review
- Scope: `warehouse/` (React client) + `server/` (Express + Prisma)
- Supersedes: the embedded "Stock Demand" overlay inside `warehouse/src/pages/LensStock.tsx` as the *primary* workflow (see "Relationship to existing LensStock demand mode").

## 1. Goal

Give the warehouse shop a dedicated **Demand** page with **saved, multi-status demand lists**:

- A warehouse worker builds a *demand* — which lens powers to order, per coating — by tapping through the familiar power grid.
- The list is **saved server-side**, can hold **multiple open lists at once** (e.g. one per supplier), and progresses through a lifecycle: **Open → Sent → Closed**.
- PDF (the existing "Stock Demand" format) is downloadable for **every list at any status**.
- Lists and their history are kept forever; only **unsent (Open) drafts** can be deleted.
- Fulfillment is **manual**: closing a list never touches stock. Staff update stock separately on the existing Update Stock page.

## 2. Requirements (from clarifying Q&A)

1. **Full lifecycle** — create, edit, send, close; statuses persisted server-side.
2. **Manual stock update on fulfillment** — closing a list does not modify any stock table.
3. **Statuses Open → Sent → Closed**: Open lists are editable; after Sent the items are locked (read-only, PDF still available); Closed is the terminal state (read-only history).
4. **PDF for every list** — at any status, from both the list row and the builder.
5. **Warehouse-only** — the shop-side app (`client/`) is untouched.
6. **History kept** — no permanent delete; only Open drafts may be deleted.
7. **Multiple open lists** — a list has no required name; unlabelled lists are identified by sequence number (`#N`). (An optional name may be added later.)

## 3. Assumed decisions (defaults taken, user to confirm)

- **Send confirmation**: "Mark as Sent" shows a lightweight client-side confirm dialog, since Send is one-way. Purely cosmetic; if the user prefers a single click, no code shape changes.
- **Navigation**: Demand goes in the sidebar drawer (`sidebarMenu` in `Layout.tsx`). The mobile bottom bar stays at 5 slots to avoid the 375px overflow issue seen elsewhere in this codebase. Reachable on mobile via the hamburger drawer.
- The existing embedded LensStock demand mode stays intact in code (no removal), but the new page becomes the primary entry point. Low regression risk; deduplication can happen later if desired.

## 4. Data model (Prisma — `server/prisma/schema.prisma`)

Following the naming conventions of `WarehouseLensStock` (camelCase fields, `@map` snake_case columns, `_id`):

```prisma
model WarehouseDemandList {
  id        String   @id @default(uuid()) @map("_id")
  status    String   @default("open")        // open | sent | closed
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  sentAt    DateTime?
  closedAt  DateTime?
  createdBy String   @default("")            // warehouse username string
  items     WarehouseDemandItem[]

  @@map("warehouse_demand_lists")
}

model WarehouseDemandItem {
  id       String  @id @default(uuid()) @map("_id")
  listId   String
  coating  String
  lensType String                // plain | sph | cyl | compound
  powerKey String                // e.g. "-2.00" or "-2.00|-1.00" for compound
  qty      Float                 // 0.5-step pairs, mirrors grid interaction
  list     WarehouseDemandList @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@index([listId])
  @@map("warehouse_demand_items")
}
```

Notes:

- `qty` is `Float` because the grid steps in 0.5 pairs.
- `onDelete: Cascade` on items is the **only** cascade in the schema. It is safe because these are brand-new tables — nothing else references a `WarehouseDemandItem`. Deleting an Open draft nils nothing else.
- `status` is a plain `String` (matching how `inventoryType` / `type` are handled elsewhere); no DB enum.
- No `branchId`, matching `warehouse_lens_stock` — the warehouse app is cross-branch.
- Migration: `prisma migrate dev` from the server package (repo convention — only one init migration exists; prod deploys via `prisma migrate deploy` in `server/package.json` start/build scripts).

## 5. API

Routes added to `server/src/routes/warehouse.ts`, all behind `authenticate` (matching siblings), delegating to a new controller + service pair.

| Method | Route | Purpose | Guard |
|---|---|---|---|
| GET | `/api/warehouse/demands` | list all lists (optional `?status=`) | — |
| POST | `/api/warehouse/demands` | create list (`{ items?: [...] }`) | — |
| GET | `/api/warehouse/demands/:id` | detail incl. items | — |
| PUT | `/api/warehouse/demands/:id` | replace items (`{ items: [...] }`) | only `status === "open"` |
| POST | `/api/warehouse/demands/:id/send` | `open → sent`; sets `sentAt` | only `status === "open"` |
| POST | `/api/warehouse/demands/:id/close` | `sent → closed`; sets `closedAt` | only `status === "sent"` |
| DELETE | `/api/warehouse/demands/:id` | delete (drafts only) | only `status === "open"` |

Response serialization mirrors the rest of the API: `{ success, data, message }` via `sendSuccess` / `sendCreated`, plus a MongoDB-compatible `_id` alias for list + items (matching the repo-wide response-serializer convention).

Validation: a new zod validator (`server/src/validators/warehouseDemand.validator.ts`), mirroring `demandSendSchema` in `order.validator.ts`:

- `lensType` ∈ {`plain`, `sph`, `cyl`, `compound`}
- `coating` non-empty string
- `powerKey` non-empty string
- `qty` number, multiple of 0.5, ≥ 0.5, ≤ 200
- items array length ≥ 1 when present

### List ordering

Lists come back newest-first (`createdAt desc`). The `#N` sequence number is **derived** at read time (index of the list within newest-first order over *all* lists, not a stored counter) — simpler and stable enough for identification; confirmed acceptable in requirement #7.

## 6. Frontend — `warehouse/src/pages/Demands.tsx`

A single `Demands` page with two views.

### 6a. Lists view (default)

- Header: page title + **＋ New Demand** primary button.
- Filter chips: **All / Open / Sent / Closed** (client-side filter or `?status=` param — decide at implementation).
- Rows per list: `#N`, `createdAt` (time today, else date), `by <user>`, item summary (`16 lenses · 24 p · ₹12,400`), status badge, per-status actions:

  | Action | Open | Sent | Closed |
  |---|---|---|---|
  | Edit (open builder) | yes | — | — |
  | View (read-only builder) | — | yes | yes |
  | Download PDF | yes | yes | yes |
  | Send (confirm dialog) | yes | — | — |
  | Close | — | yes | — |
  | Delete (confirm dialog) | yes | — | — |

- Empty state: friendly "Create your first demand list" + CTA.

### 6b. Builder view (create / edit Open / view locked)

Reuses the interaction model of the existing LensStock demand mode:

- Back link → lists view.
- Fill-target stepper ("Fill each power up to N p") — same semantics as today.
- Coatings sidebar (badge = pairs already selected).
- **Plain / SPH / CYL / Compound** tabs + power/value grid; tap power → add 0.5 pairs, badge → remove; low-stock cells shaded like today.
- Action bar: selected count, total pairs, projected amount (`qty × price`), **All low stock**, **Clear**, **Download PDF**, **Save** (Open only), **Mark as Sent** (Open only; confirm dialog).
- Locked lists (Sent/Closed): same read-only view with PDF only, no editing; banner "List sent — locked".

### 6c. State & UX coverage

- Loading skeleton while lists/stock fetch; error toast + retry on API failure (the app's `api` wrapper already returns structured errors + timeout).
- Send/Close/Delete failures surface inline (`error` toast); no silent failure.
- Empty builder guard: Save/Send disabled until ≥ 1 item.
- Delete dialog: "Delete this demand? History is removed permanently — only unsent drafts can be deleted."
- Amount display uses the same arithmetic as today's demand mode (`fmtPairs`, `fmtP`, `roundHalf`, `priceForPower`).

### 6d. Routing & navigation

- `App.tsx`: add lazy route `Demand` → `/demand` (`React.lazy` + `SuspendedPage`, same pattern as siblings).
- `Layout.tsx`: add `Demand` to `sidebarMenu` only (desktop drawer + mobile hamburger), with a lucide icon (e.g. `ClipboardList`).

## 7. PDF output

Reuse `warehouse/src/utils/demandPdf.ts` → `generateDemandPdf({ coating, price, pricePos, priceNeg, items, title, timestamp })`. Items are the saved list items; title = `Demand #N`. Same header/footer format as the existing "Stock Demand" PDF so printed output stays consistent. Needs data fetching for `WarehouseLensStock` coating → price for lines (grid already displays this; the page must fetch `/api/warehouse/lens-stock/list` for both the grid and PDF amounts).

## 8. Conventions followed

- Controller/service pair + router additions, `asyncHandler`, `authenticate` — identical to `warehouseLensStock*`.
- Zod validator mirroring `order.validator.ts`.
- Prisma camelCase + `@map` snake_case; `_id` alias via response serializer.
- Client fetch through existing `warehouse/src/api.ts` wrapper (Bearer `wh_accessToken`, auto-refresh).
- No `branchId` anywhere (warehouse is cross-branch).

## 9. Out of scope

- Auto-restocking on Close (explicitly **manual** by decision).
- Shop-side (`client/`) changes.
- Deleting Sent/Closed lists (kept forever by decision).
- Printer labels, WhatsApp send, or per-supplier routing.
- Removing the legacy LensStock demand overlay (kept in code).

## 10. Verification

- `npx tsc --noEmit` in `server/` and `warehouse/`.
- `npx vitest run` in `server/` (existing 32 tests must still pass).
- Manual browser pass in the warehouse app: create → edit → save → reopen → send (confirm) → locked → close → PDF at every status; delete draft; multiple drafts coexist; refresh persists.