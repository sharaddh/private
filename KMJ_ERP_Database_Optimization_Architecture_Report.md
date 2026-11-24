# KMJ ERP — Database & Application Efficiency Refactor Plan

**Scope:** Code and architecture changes only. Environment-variable changes, Render configuration, Neon plan changes, and production infrastructure changes are explicitly deferred to the next phase.

**Repository snapshot reviewed:** `private-main` ZIP, commit/archive identifier `36c4c711132a1122fe0b3f336bfb5c0176c7d9ae` (archive dated 2026-11-15).

---

## 1. Executive summary

Neon reports **6.86 GB network transfer against a 5 GB allowance** for the period shown. The supplied Render logs also show Prisma `P1001` connection failures and repeated WhatsApp worker errors. These facts establish that the database became unreachable and that the network-transfer allowance was exceeded. They do **not**, by themselves, prove which endpoint or job consumed the 6.86 GB.

The source snapshot contains several worthwhile optimization targets:

1. The dashboard service launches a large `Promise.all` containing roughly 34 database operations, including multiple counts, aggregates and list queries.
2. Some dashboard lists have no explicit `take` limit, notably pending bills, delivered orders for today, and draft orders.
3. The WhatsApp worker has an event-wake mechanism but also runs a fallback `setInterval` poll. Its configured fallback interval defaults to 15 minutes and is clamped to a minimum of 30 seconds.
4. The report service fetches year-to-date bill/payment rows and calculates monthly totals in application memory; the inventory report fetches matching inventory rows to calculate totals.
5. Branch middleware performs a PostgreSQL lookup before the child route middleware, including before route-level cache middleware can serve a cache hit.
6. The current route cache is keyed by branch identifier and URL, and cache invalidation behavior needs a correctness and isolation review before expanding cache coverage.

These are code-level findings and optimization opportunities, not a measured attribution of Neon egress. Implement instrumentation first, then optimize the largest measured contributors.

---

## 2. Goals and non-goals

### Goals

- Reduce bytes returned from PostgreSQL to the Node.js service.
- Reduce unnecessary database round trips.
- Bound every user-facing list query.
- Move totals, counts and grouped summaries into PostgreSQL.
- Avoid idle background polling where event-driven wake-ups can safely do the work.
- Preserve business rules, branch isolation, financial correctness, WhatsApp delivery semantics and existing API response contracts unless a deliberate versioned change is approved.
- Make the effect measurable before and after deployment.

### Non-goals in this phase

- Do not change Render environment variables.
- Do not change Neon compute, plan, autosuspend or network settings.
- Do not rotate or replace database credentials.
- Do not change production secrets.
- Do not perform schema migrations or destructive data cleanup unless a migration is separately reviewed and approved.
- Do not disable WhatsApp campaigns, reminders, webhook processing or notifications as a shortcut.
- Do not blindly increase cache TTLs or cache financial/operational data without correct invalidation.

---

## 3. Findings from the reviewed source snapshot

### 3.1 WhatsApp worker

**Files**
- `server/src/whatsapp/worker.ts`
- `server/src/whatsapp/config.ts`
- `server/src/whatsapp/wake.ts`
- `server/src/whatsapp/worker-entry.ts`

**Observed implementation**
- `startWhatsAppWorker()` registers an in-process wake listener.
- It immediately runs a tick at startup.
- It also starts `setInterval(() => void tick(), cfg.workerPollMs)`.
- `requestWhatsAppWorkerTick()` wakes registered in-process listeners.
- Each `runWhatsAppWorkerOnce()` can call campaign materialization, webhook processing, reminder processing, outbox processing and branch discovery.
- `processingBranches()` performs a campaign `groupBy` and a due-reminder `findMany`.
- The default `workerPollMs` in `config.ts` is 15 minutes; `intEnv` clamps the minimum to 30 seconds.
- `render.yaml` in this repository snapshot sets the polling value to `900000` (15 minutes), inline worker to true, and the configured window to 09:00–21:00 Asia/Kolkata.

**Important interpretation**
The Render log excerpt showed failures approximately every 30 seconds. The checked-in snapshot does not explain that exact interval: its checked-in Render value is 900000 ms. Possible explanations include a live Render environment override, a different deployed commit, or a different service/process. Resolve this in the later environment/deployment phase. Do not claim that the repository itself configures 30-second polling.

**Required changes**
1. Make the worker tick single-flight and retain that guarantee across every scheduling path.
2. Add bounded exponential backoff with jitter after database/connectivity failures. Do not continue the ordinary fast retry cadence while Neon is unreachable.
3. Keep normal fallback polling slow. Event wake-ups should trigger prompt work; the fallback timer should be a safety net, not the primary queue mechanism.
4. Prevent a tick from overlapping with itself. A wake received during a tick should schedule at most one follow-up tick.
5. Do not schedule rapid drain ticks indefinitely. Continue draining only when a batch indicates that more work is immediately available; cap consecutive drain cycles and yield.
6. Make retention cleanup run on its own low-frequency schedule, rather than coupling its timing to every normal work tick.
7. Add structured metrics/logs: tick start/end, duration, work counts, DB error code, backoff duration, wake reason and worker instance ID.
8. Verify whether the inline worker is started exactly once per application process and whether any separately deployed worker is also running. Avoid two independent workers processing the same queue unless the database claiming/locking protocol explicitly supports it.
9. Preserve webhook, scheduled campaign and reminder delivery guarantees. Test the case where a wake event occurs while the worker is busy.

**Acceptance criteria**
- A DB outage does not cause a tight retry loop.
- At most one tick runs per worker instance at a time.
- A queued event wakes the worker promptly.
- Scheduled campaigns/reminders still execute within the agreed service-level window.
- Worker logs expose tick counts and error/backoff behavior without logging message contents, phone numbers or secrets.

### 3.2 Dashboard query fan-out and unbounded lists

**File:** `server/src/services/dashboard.service.ts`

**Observed implementation**
`getStats()` launches a `Promise.all` with approximately 34 Prisma operations. The batch includes counts, aggregates, groupings and list queries. Some results are later transformed in Node.js.

Specific queries needing attention:
- `pendingBills`: `bill.findMany()` for active bills with `pendingAmount > 0`, ordered by creation date, without `take`.
- `todayDeliveredOrders`: delivered orders for the day, without `take`.
- `incompleteOrders`: draft orders, without `take`.
- `billsForDailySales`: retrieves each active bill in a 30-day window to calculate daily totals in application memory.
- `ordersForDailyCounts`: retrieves order timestamps for the 30-day window.
- `paymentsForDailyCounts`: retrieves payment mode/amount/date for the 30-day window.
- `paymentsForModeSplit` and `paymentsForTodayModeSplit`: retrieve rows for in-memory grouping.
- Additional prescription queries are made after the initial `Promise.all`.

**Required changes**
1. Divide dashboard data into:
   - scalar KPI aggregates/counts;
   - bounded recent-activity lists;
   - bounded operational queues;
   - chart series and grouped summaries.
2. Replace row-fetch-and-loop calculations with database-side aggregation/grouping wherever the required grouping semantics can be represented correctly.
3. Add explicit limits and pagination to all dashboard lists. Suggested initial caps:
   - recent orders: 10;
   - delivered today: 10 or 20;
   - draft orders: 10 or 20;
   - pending bills preview: 10 or 20.
   Provide separate paginated endpoints for the full lists rather than silently truncating a list the UI treats as complete.
4. Use explicit `select` projections for every list. Avoid `include` when only a small subset of related fields is rendered.
5. Do not fetch prescription rows for every order if only a preview is displayed. Fetch only prescriptions for the bounded set of displayed order/visit IDs.
6. Avoid duplicate counts/aggregates if one query can return equivalent metrics without changing semantics. Do not merge queries merely to reduce query count if doing so produces a much larger result or more complex SQL.
7. Keep branch and date predicates on every query.
8. Preserve the current IST day/week/month boundaries. Add tests around midnight, month-end, year-end and leap-year dates.
9. Define a dashboard response contract and test each KPI against the existing implementation using a fixed test dataset before replacing it.

**Important**
A `Promise.all` with 34 operations does not automatically mean 34 expensive queries or prove excessive egress. The unbounded row-returning queries are the more obvious transfer risk. Measure query counts, rows and response bytes before and after.

### 3.3 Reports: aggregate in PostgreSQL

**File:** `server/src/services/report.service.ts`

**Observed implementation**
- Monthly reporting fetches year-to-date active bill rows and payment rows, then groups them by month in Node.js.
- Inventory reporting fetches matching inventory rows (category, location, quantity and selling price) to calculate summary totals in Node.js.
- Customer report already uses bounded top-customer results and grouped city counts.
- Delivery reporting includes a bounded overdue-delivery list and a historical delivery-date query used for duration calculations; inspect the full calculation before changing it.

**Required changes**
1. Monthly revenue/collection: use Prisma `groupBy` where the database grouping key is adequate. If grouping by IST calendar month cannot be expressed safely with Prisma's current API, use a parameterized raw SQL query with an explicit IST timezone conversion and tests.
2. Inventory summary: use database-side `count`, `_sum`, and `groupBy` for total quantity/value/category summaries. Retain a separately bounded low-stock item list.
3. Delivery duration: calculate average/median or other existing statistic in SQL only after documenting its exact current definition, null handling and timezone semantics. Do not silently change the metric.
4. Keep detail endpoints paginated and summaries small.
5. Add regression tests comparing old and new report output on representative fixtures.

### 3.4 Branch middleware and cache ordering

**Files**
- `server/src/middleware/branch.ts`
- `server/src/middleware/cache.ts`
- `server/src/routes/index.ts`
- `server/src/routes/dashboard.ts`

**Observed implementation**
- `routes/index.ts` applies `branchScope` to dashboard and several other route groups.
- `branchScope` performs `prisma.branch.findUnique()` for a supplied branch ID.
- The child route then applies authentication and `cacheRoute`.
- Therefore, a cache hit in a child route can still incur the branch lookup performed earlier in the parent route middleware.
- `cacheRoute` uses a key based on branch header/query and `req.originalUrl`.
- `invalidateCache()` also attempts broad dashboard invalidation through a wildcard-like key.

**Required changes**
1. Review authentication/authorization and branch resolution as one security boundary. Never trust a client-supplied branch ID without verifying that the authenticated user is authorized for that branch.
2. Avoid a database branch lookup on every cached request only if branch validity/authorization can be safely established from trusted authenticated context or a short-lived, correctly invalidated branch metadata cache.
3. Do not move cache middleware ahead of authentication or authorization.
4. Build cache keys from a canonical, authorized branch ID and include any user/role/permission dimension that changes the response. Do not allow one user's response to be served to another user if their data visibility differs.
5. Review wildcard invalidation. Confirm that `cacheDel` actually supports pattern deletion; if it does not, replace it with explicit keys, tag/version-based invalidation, or a supported Redis SCAN-based strategy with safe limits.
6. Add tests for branch A vs branch B, users with different permissions, cache HIT/MISS, mutation invalidation and cache outage.
7. Cache only safe GET responses. Never cache authentication responses, private payment credentials, one-time tokens or responses whose content varies by unrepresented authorization context.

**Critical correctness note**
The existing cache key appears to use the branch header/query value before canonical authorization is demonstrated in this middleware. Treat this as a cache-isolation review, not merely a performance change.

### 3.5 Prisma connection setup

**File:** `server/src/db/prisma.ts`

**Observed implementation**
- A shared PrismaClient is created.
- Pooled Neon URLs are detected.
- The code adds `pgbouncer=true` for pooled endpoints if absent.
- It adds default `connection_limit=3` for pooled URLs and `pool_timeout=10`.
- `connectDatabase()` retries connection attempts with a bounded linear delay.

**Required changes**
- Do not rewrite this file speculatively.
- Add diagnostics for connection startup and failure codes, without logging the full database URL.
- Verify actual production URL format and Prisma version compatibility in the environment phase.
- Review whether the connection retry policy is appropriate for startup versus runtime requests. Runtime query retry should be selective and must not blindly replay non-idempotent writes.
- Confirm graceful shutdown calls `$disconnect()` for the web process.
- Keep one PrismaClient per process.
- Do not increase connection limits without measuring Render instance count and Neon connection behavior.

### 3.6 API list endpoints and frontend request behavior

The repository contains many cached GET routes (customers, orders, bills, payments, inventory, visits, prescriptions, delivery, reports and inventory V2). A full endpoint-by-endpoint audit should be performed as a separate implementation pass.

**Required changes**
1. Search every Prisma `findMany()` used by user-facing list endpoints.
2. Require pagination or a documented strict upper bound for every list endpoint.
3. Require explicit `select` fields for list responses.
4. Use cursor pagination for large, frequently changing tables where stable ordering is available; otherwise use deterministic offset pagination with a maximum page size.
5. Add server-side filters and sorting with allowlisted fields.
6. Ensure search endpoints are debounced on the client and do not issue a request per keystroke.
7. Deduplicate identical in-flight frontend requests and use a consistent query cache where appropriate.
8. Avoid refetching unchanged dashboard data on every component mount/navigation. Use stale-time and invalidation rules based on the mutation domain.
9. Inspect browser Network traces to identify duplicate API calls before introducing more client caching.
10. Ensure all client caches are branch-aware and cleared when the active branch or authenticated account changes.

---

## 4. Required instrumentation before optimization

Add lightweight, structured telemetry before changing query behavior. The purpose is to identify the actual source of database traffic.

### 4.1 API request metrics

For each request, record:
- route template (e.g. `/api/orders/:id`, not raw sensitive query values);
- HTTP method and status;
- duration;
- response byte count;
- request ID;
- authorized branch ID (opaque/internal identifier only);
- cache HIT/MISS/BYPASS;
- service name and instance ID.

Do not log request bodies, access tokens, phone numbers, customer names, prescription data or payment details.

### 4.2 Database query metrics

Instrument Prisma query events or a centralized query wrapper to capture:
- model/action or normalized query label;
- duration;
- request correlation ID where available;
- rows returned where reliably measurable;
- error code;
- worker/API origin.

Avoid logging raw SQL parameters or personal data. Query event timing alone does not provide exact network bytes; use it as a workload signal, not as a substitute for Neon egress metrics.

### 4.3 Worker metrics

Record:
- ticks started/completed/failed;
- tick duration;
- wake reason;
- campaigns materialized;
- recipients processed;
- outbox rows processed;
- webhook events processed;
- reminders processed;
- DB error code and retry/backoff;
- whether work was found.

### 4.4 Cache metrics

Record:
- hits, misses, bypasses and errors;
- key namespace, TTL and response size;
- invalidation count and reason.

Never log full cache values.

### 4.5 Baseline window

Before refactoring, collect at least one representative business-day window if possible:
- requests by route;
- total response bytes by route;
- query count/duration by model/action;
- dashboard cache hit ratio;
- worker tick frequency and work yield;
- Neon network transfer and compute metrics.

Compare equivalent time windows after deployment. Account for business volume and user activity.

---

## 5. Implementation sequence

### Phase A — Safety and observability (first PR)

1. Add request/response byte and duration metrics.
2. Add cache HIT/MISS/BYPASS counters.
3. Add worker tick metrics and error classification.
4. Add Prisma query timing instrumentation with safe redaction.
5. Add tests for instrumentation not changing API behavior.
6. Establish baseline.

**Do not change environment variables in this phase.**

### Phase B — WhatsApp worker reliability

1. Confirm single-flight execution and single worker ownership.
2. Add exponential backoff with jitter on database failures.
3. Keep event-driven wake behavior.
4. Retain a slow fallback heartbeat.
5. Bound drain cycles.
6. Separate retention sweep cadence.
7. Add tests for outage, recovery, duplicate wake, shutdown and pending work.

**Do not change Render's `WHATSAPP_WORKER_*` values yet.** First merge code changes and then reconcile live values with `render.yaml` in the separate environment phase.

### Phase C — Dashboard optimization

1. Capture baseline dashboard response and query profile.
2. Add strict limits to unbounded dashboard lists.
3. Move daily chart calculations to grouped DB queries.
4. Reduce duplicate/overlapping aggregate calls where safe.
5. Narrow all projections.
6. Fetch prescriptions only for displayed orders.
7. Preserve output shape and IST semantics.
8. Add fixture-based regression tests.

### Phase D — Reports optimization

1. Replace YTD row fetching with monthly grouped aggregation.
2. Replace inventory row fetching with aggregate/groupBy.
3. Optimize delivery duration calculation after documenting its definition.
4. Keep detailed records in paginated endpoints.
5. Compare old/new report outputs.

### Phase E — Cache and branch resolution

1. Audit authentication and branch authorization.
2. Make cache key canonical and authorization-aware.
3. Confirm invalidation implementation actually deletes intended keys.
4. Avoid DB branch lookup on cache hits only through a secure trusted-context design.
5. Add cross-branch and cross-role cache tests.
6. Test behavior when Redis is unavailable.

### Phase F — Endpoint and frontend audit

1. Audit all `findMany()` calls in controllers/services.
2. Bound and paginate list endpoints.
3. Add projections and allowlisted filters.
4. Inspect client duplicate requests and request waterfalls.
5. Add request deduplication and branch-aware query caching where justified.
6. Verify warehouse frontend separately from the main client.

---

## 6. Suggested architecture after refactor

```text
Browser / Warehouse UI
        |
        v
API Gateway / Express
        |
        +--> Authentication
        |
        +--> Authorized Branch Context
        |
        +--> Request Metrics
        |
        v
Route Handler
        |
        +--> Safe Response Cache (authorized, branch-aware)
        |        |
        |        +--> HIT: return bounded cached response
        |        |
        |        +--> MISS
        |
        v
Service Layer
        |
        +--> KPI Aggregations (PostgreSQL)
        |
        +--> Paginated Detail Queries
        |
        +--> Domain Mutations
        |
        v
Prisma (one client per process, pooled Neon endpoint)
        |
        v
Neon PostgreSQL

WhatsApp event / campaign / webhook enqueue
        |
        v
Worker Wake Signal
        |
        v
Single-flight Worker
        |
        +--> bounded batch claim
        +--> process and persist result
        +--> bounded drain if work remains
        +--> slow fallback poll with backoff
```

The cache is an optimization, not the source of truth. Financial, inventory and order writes must commit to PostgreSQL first. Cache invalidation should happen after successful commit.

---

## 7. Testing and acceptance criteria

### Correctness
- Dashboard KPI values match the existing implementation on fixed fixtures.
- Monthly reports match the existing implementation across timezone boundaries.
- Inventory totals and valuations match the old implementation.
- Branch A cannot read Branch B data through cache or direct API calls.
- Different permission levels cannot share an inappropriate cached response.
- WhatsApp campaigns, reminders, webhooks and outbox messages are not lost or duplicated.

### Performance
Set targets only after baseline measurement. Initial engineering targets:
- No unbounded list query in dashboard or report preview endpoints.
- All list endpoints have pagination or an explicit maximum result count.
- Dashboard response bytes materially decrease for large branches.
- Dashboard DB rows returned materially decrease.
- Worker performs no rapid repeated retry loop during a database outage.
- Cache HIT avoids service-layer data queries; any remaining branch lookup is measured and documented.
- No material regression in p95 response time.

### Resilience
- Redis unavailable: application continues safely with cache bypass.
- Neon unavailable: API returns controlled 503 where DB is required; worker backs off.
- Neon resumes: worker recovers without manual restart or duplicate work.
- SIGTERM/SIGINT: worker stops scheduling and exits cleanly.
- Concurrent worker wake signals do not create overlapping ticks.

---

## 8. Deployment and rollback plan

1. Create a dedicated branch for the refactor.
2. Implement Phase A first and deploy instrumentation only.
3. Validate logs and baseline metrics.
4. Implement one optimization phase per PR.
5. Run typecheck, lint, unit tests and integration tests.
6. Deploy during a low-activity period.
7. Verify login, branch switching, dashboard, orders, billing, inventory, reports and WhatsApp flows.
8. Compare equivalent Neon transfer windows and Render request/response metrics.
9. Keep a rollback commit for each phase.
10. Do not combine schema migrations, environment changes and query refactors in one deployment.

For any database aggregation implemented with raw SQL:
- use parameterized queries;
- never concatenate user input;
- test against the production PostgreSQL major version;
- verify indexes with `EXPLAIN (ANALYZE, BUFFERS)` on safe representative data, not on a live peak workload.

---

## 9. Explicit instructions for the coding agent

Implement the work in the repository, not merely produce suggestions.

1. Start by reading the existing architecture and tests. Do not rewrite modules wholesale.
2. Create a short implementation checklist and identify the exact files to change.
3. Implement **Phase A instrumentation only** first.
4. Run typecheck, lint and tests; report results.
5. Then implement worker reliability, dashboard, reports, cache/branch and frontend changes in separate commits or clearly separated changesets.
6. Preserve API contracts unless a change is necessary; document any contract change and update all consumers.
7. Do not modify `.env`, `.env.production`, Render environment values, Neon settings, secrets or deployment configuration in this task.
8. Never print secrets into logs or reports. If a tracked environment file contains real credentials, do not copy its contents; flag it for a separate security remediation.
9. Do not remove features or disable WhatsApp functionality to improve metrics.
10. For each change, report:
   - files changed;
   - behavior changed;
   - reason;
   - tests run and results;
   - expected impact;
   - remaining uncertainty.
11. Do not claim a measured Neon bandwidth reduction until post-deployment metrics demonstrate it.

---

## 10. Separate next phase: environment reconciliation

After code changes are merged and tested, we will inspect the live Render environment separately.

In particular, reconcile:
- deployed commit vs reviewed repository snapshot;
- live `WHATSAPP_WORKER_POLL_MS` vs `render.yaml` value of `900000`;
- live inline worker setting;
- whether a second worker service/process exists;
- actual `DATABASE_URL` endpoint type (pooled vs unpooled), without exposing credentials;
- Redis availability and connection behavior;
- Render instance count and restarts.

The 30-second worker errors in the supplied logs do not match the checked-in 15-minute Render configuration. This discrepancy must be resolved with live deployment/environment evidence; do not guess or change the environment during the code-only phase.

---

## 11. Final priority list

| Priority | Work item | Why |
|---|---|---|
| P0 | Add instrumentation and establish baseline | Attribute actual resource use |
| P0 | Worker backoff and single-flight behavior | Prevent retry storms during DB outage |
| P0 | Bound dashboard lists | Prevent unbounded result transfer |
| P1 | Aggregate dashboard charts in PostgreSQL | Reduce rows transferred |
| P1 | Aggregate monthly/inventory reports in PostgreSQL | Avoid fetching full datasets |
| P1 | Secure and correct cache key/invalidation design | Safe cache hits and fewer DB reads |
| P1 | Audit every list endpoint for pagination/projection | Prevent other high-volume reads |
| P2 | Frontend request deduplication and stale-data strategy | Reduce repeated API requests |
| P2 | Index review based on measured query plans | Improve query execution without speculative indexes |

**Definition of done:** The code changes are tested, the API and business behavior are preserved, telemetry identifies the heaviest routes/queries/workers, and the post-deployment comparison shows whether Neon transfer and compute consumption actually improved. Environment changes are a separate, subsequent task.
