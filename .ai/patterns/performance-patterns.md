# Performance Patterns — KMJ Optical ERP

> Reference guide for all performance optimization conventions in the KMJ Optical ERP.

---

## 1. Database Query Optimization Patterns

**Purpose:** Write efficient MongoDB queries that leverage indexes and minimize data transfer.

**When to use:** Every database query.

### Use .lean() for Read-Only Queries

```ts
//server/src/routes/orders.ts — lean() returns plain objects, not Mongoose documents
const list = await Order.find(filter)
  .populate("customerId", "name mobile")
  .sort({ createdAt: -1 })
  .limit(500);

// Without lean — full Mongoose document overhead
const list = await Order.find(filter).sort({ createdAt: -1 });

// With lean — 2-5x faster, less memory
const list = await Order.find(filter).sort({ createdAt: -1 }).lean();
```

### Select Only Needed Fields

```ts
// server/src/routes/delivery.ts — select specific fields from populated document
const list = await Delivery.find(filter)
  .populate("customerId", "name mobile")      // Only name and mobile
  .populate("orderId", "frame lens status")   // Only frame, lens, status
  .sort({ createdAt: -1 })
  .limit(200)
  .lean();

// server/src/controllers/authController.ts — exclude sensitive fields
const user = await User.findById(id).select("-passwordHash").lean();
```

### Use .limit() on Every Query

```ts
// Orders — capped at 500
const list = await Order.find(filter).sort({ createdAt: -1 }).limit(500);

// Inventory — capped at 200
const list = await Inventory.find(filter).limit(200).lean();

// Payments — capped at 500
const list = await Payment.find(filter).sort({ paymentDate: -1 }).limit(500).lean();

// Visits — capped at 200
const list = await Visit.find(filter).sort({ visitDate: -1 }).limit(200).lean();

// Dashboard recent items — small limits
const recentCustomers = await Customer.find().sort({ createdAt: -1 }).limit(5);
const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);
```

### Use .countDocuments() Instead of Fetching All

```ts
// server/src/controllers/customerController.ts — parallel count + find
const [data, total] = await Promise.all([
  Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
  Customer.countDocuments(filter),
]);

// server/src/routes/inventory.ts — parallel countDocuments
const [totalItems, lowStock, warehouseItems, totalValueResult] = await Promise.all([
  Inventory.countDocuments(),
  Inventory.countDocuments({ quantity: { $lte: 5 } }),
  Inventory.countDocuments({ location: "warehouse" }),
  Inventory.aggregate([
    { $group: { _id: null, total: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } } } },
  ]),
]);
```

### Anti-Pattern

```ts
// WRONG — no lean() on read-only query
const list = await Customer.find().sort({ createdAt: -1 });
// Returns full Mongoose documents with change tracking, validation, etc.

// WRONG — fetching all fields when only a few are needed
const list = await Order.find().populate("customerId"); // Pulls all customer fields

// WRONG — no limit
const list = await Order.find(); // Could return 10,000+ documents
```

### Tradeoffs

- `.lean()` removes Mongoose document features (save, validate, virtuals) — only use
  on read-only queries.
- `.select("field1 field2")` on populate reduces the amount of data transferred from
  the database.
- `.limit()` is always used — even if the dataset is small, it's a safety net.
- `.countDocuments()` is much faster than `.find().length` — uses index metadata.

### Related Patterns

- Index Patterns (database-patterns.md)
- Projection Patterns (section 3)

---

## 2. Index Usage Patterns

**Purpose:** Create and use indexes that match the most common query patterns.

**When to use:** Every field used in `find()`, `sort()`, `countDocuments()`, or `aggregate()`.

### Query-to-Index Mapping

```ts
// Query pattern → Required index
await Order.find({ customerId: id }).sort({ createdAt: -1 });
// Index: { customerId: 1, createdAt: -1 }

await Order.find({ status: "Ready" }).sort({ createdAt: -1 });
// Index: { status: 1, createdAt: -1 }

await Bill.find({ pendingAmount: { $gt: 0 } }).sort({ pendingAmount: -1 }).limit(5);
// Index: { pendingAmount: 1 }

await Customer.find().sort({ createdAt: -1 }).limit(5);
// Index: { createdAt: -1 }

await Payment.find({ customerId: id }).sort({ paymentDate: -1 });
// Index: { customerId: 1, paymentDate: -1 }

await Delivery.find({ status: "Ready" });
// Index: { status: 1, expectedDeliveryDate: 1 }
```

### Compound Index Best Practices

```ts
// server/src/models/order.ts
// Most common: filter by customer, sort by date
OrderSchemaObj.index({ customerId: 1, createdAt: -1 });

// Filter by status, sort by date
OrderSchemaObj.index({ status: 1, createdAt: -1 });

// Filter by classification, sort by date
OrderSchemaObj.index({ classification: 1, createdAt: -1 });

// server/src/models/bill.ts
// Filter by customer, sort by date
BillSchemaObj.index({ customerId: 1, createdAt: -1 });

// server/src/models/payment.ts
// Filter by customer, sort by date
PaymentSchemaObj.index({ customerId: 1, paymentDate: -1 });

// Filter by bill
PaymentSchemaObj.index({ billId: 1 });
```

### Sort Indexes

```ts
// Descending sort is most common (newest first)
CustomerSchemaObj.index({ createdAt: -1 });
OrderSchemaObj.index({ createdAt: -1 });
BillSchemaObj.index({ createdAt: -1 });
PaymentSchemaObj.index({ paymentDate: -1 });
VisitSchemaObj.index({ visitDate: -1 });
```

### Unique Indexes

```ts
// Prevent duplicates
BillSchemaObj.index({ billNumber: 1 }, { unique: true });
InventorySchemaObj.index({ sku: 1 }, { unique: true });
```

### Anti-Pattern

```ts
// WRONG — index on a field that's never queried
CustomerSchemaObj.index({ email: 1 }); // If email is never used in find()

// WRONG — too many indexes
// Each index slows down writes
OrderSchemaObj.index({ customerId: 1 });
OrderSchemaObj.index({ customerId: 1, createdAt: -1 }); // Redundant with above
OrderSchemaObj.index({ createdAt: -1, customerId: 1 }); // Also redundant
```

### Tradeoffs

- Compound indexes should be ordered: query field first, sort field second.
- `{ createdAt: -1 }` (descending) matches "newest first" — the most common sort.
- Too many indexes slow down inserts/updates — each index must be maintained.
- MongoDB can only use one index per query — compound indexes must match the full
  query pattern.

### Related Patterns

- Query Patterns (database-patterns.md)
- Dashboard Aggregation (database-patterns.md)

---

## 3. Caching Patterns (Redis + Route Caching)

**Purpose:** Cache frequently accessed data to reduce database load and improve response times.

**When to use:** GET endpoints that return stable data.

### Redis Cache Service

```ts
// server/src/services/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null;
  try {
    const raw = await client!.get(prefixed(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isConnected()) return;
  const value = typeof data === "string" ? data : JSON.stringify(data);
  try {
    await client!.setex(prefixed(key), ttl, value);
  } catch (e) { /* set failure is non-fatal */ }
}
```

### Route Cache Middleware

```ts
// server/src/middleware/cache.ts
export function cacheRoute(ttlSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    const key = `${branchKey(req)}:${req.originalUrl}`;
    const cached = await cacheGet<{ body: unknown; status: number }>(key);
    if (cached) {
      res.set("x-cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }

    res.set("x-cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode < 400) {
        cacheSet(key, { body, status: res.statusCode }, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}
```

### TTL Strategy

```ts
// server/src/config.ts
export const CACHE_TTL = {
  DASHBOARD: 30,    // Changes frequently (real-time stats)
  CUSTOMERS: 60,    // Changes moderately
  INVENTORY: 60,    // Changes moderately
  ORDERS: 30,       // Changes frequently
  BILLS: 30,        // Changes frequently
  DEFAULT: 60,
} as const;
```

### Branch-Scoped Cache Keys

```ts
// Cache keys include branch ID for multi-tenant isolation
function branchKey(req: Request): string {
  const branchId = req.headers["x-branch-id"] as string || req.query._branch as string || "default";
  return branchId;
}

// Key format: "branchId:/api/customers?limit=1000"
const key = `${branchKey(req)}:${req.originalUrl}`;
```

### Cache Invalidation with Pipeline

```ts
// server/src/services/cache.ts
export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected()) return;
  try {
    const branchPattern = pattern.startsWith("*:") ? pattern : `*:${pattern}`;
    const keys = await scanKeys(branchPattern);
    if (keys.length > 0) {
      const pipeline = client!.pipeline();
      keys.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
  } catch (e) { /* del failure is non-fatal */ }
}
```

### Anti-Pattern

```ts
// WRONG — caching POST/PUT/DELETE endpoints
router.post("/", authenticate, cacheRoute(60), asyncHandler(...));

// WRONG — no cache invalidation after mutation
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body);
  // Missing: await invalidateCache("/api/inventory");
  res.json({ success: true, data: item });
}));

// WRONG — no TTL on cache entries
await client.set("key", value); // Never expires, stale forever
```

### Tradeoffs

- Redis failure is non-fatal — `cacheGet` returns null, `cacheSet` is a no-op.
- `x-cache: HIT` / `x-cache: MISS` headers help with debugging but add slight overhead.
- Cache invalidation uses SCAN for pattern matching — safe for large key sets.
- Dashboard is always invalidated alongside other resources because it aggregates all data.
- `cacheSet` is fire-and-forget (`.catch(() => {})`) to avoid slowing down responses.

### Related Patterns

- Redis Service (backend-patterns.md)
- Cache Middleware (api-patterns.md)

---

## 4. Client-Side Caching Patterns

**Purpose:** In-memory cache with TTL to avoid re-fetching data on component remounts.

**When to use:** Data fetched across multiple component lifecycles.

### In-Memory Cache Store

```ts
// client/src/hooks/useCache.ts
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, CacheEntry<unknown>>();

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now(), promise: null });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function getCacheSnapshot<T>(key: string, customTtl?: number) {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { data: null, exists: false, expired: false };
  return { data: entry.data, exists: true, expired: isExpired(entry, customTtl) };
}
```

### Stale-While-Revalidate in useApi

```tsx
// client/src/hooks/useApi.ts
useEffect(() => {
  const snapshot = cacheKey ? getCacheSnapshot<T>(cacheKey) : null;
  if (snapshot?.exists && !snapshot.expired) {
    // Serve from cache, refresh in background
    setData(snapshot.data);
    setLoading(false);
    fetch(true); // Background refresh (isBackground = true)
  } else if (snapshot?.exists && snapshot.expired) {
    // Show stale data while refreshing
    setData(snapshot.data);
    setLoading(true);
    fetch();
  } else {
    // No cache, full loading
    fetch();
  }
}, [fetch]);
```

### Request Deduplication

```ts
// client/src/hooks/useCache.ts
export function getCachedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing?.promise) return existing.promise; // Return in-flight promise
  if (existing && !isExpired(existing)) return Promise.resolve(existing.data);

  const promise = fetcher().then((data) => {
    store.set(key, { data, timestamp: Date.now(), promise: null });
    return data;
  }).catch((err) => {
    store.delete(key);
    throw err;
  });

  store.set(key, { data: null as unknown as T, timestamp: 0, promise });
  return promise;
}
```

### Manual Cache Invalidation

```tsx
// After mutations, invalidate related cache keys
const refetch = useCallback((invalidate?: boolean) => {
  if (invalidate) invalidateCache("/api/customers?limit=1000");
  fetchCustomers();
}, [fetchCustomers]);

// Usage
invalidateCache("/api/customers?limit=1000");
invalidateCache("/api/orders");
```

### Anti-Pattern

```tsx
// WRONG — no caching, re-fetches on every mount
useEffect(() => {
  api.get("/api/customers").then(res => setList(res.data));
}, []); // Runs on every mount

// WRONG — no TTL, stale data forever
const store = new Map<string, any>(); // Never expires

// WRONG — no request deduplication
// Three components mount simultaneously, three identical API calls fire
```

### Tradeoffs

- 5-minute TTL is appropriate for ERP data that doesn't change rapidly.
- Stale-while-revalidate provides instant navigation while keeping data fresh.
- `getCachedPromise` prevents duplicate in-flight requests — important when multiple
  components mount simultaneously (e.g., dashboard).
- Cache is a simple `Map` — no persistence across page reloads (by design).

### Related Patterns

- useApi Hook (react-patterns.md)
- Server-Side Cache (section 3)

---

## 5. Connection Pooling Patterns

**Purpose:** Reuse MongoDB connections across requests to avoid connection overhead.

**When to use:** MongoDB connection configuration.

### Mongoose Connection

```ts
// server/src/index.ts (or wherever mongoose.connect is called)
import mongoose from "mongoose";

// Mongoose handles connection pooling automatically
await mongoose.connect(MONGO_URI, {
  // Default pool size: 5 connections
  // Can be configured via maxPoolSize option
});
```

### Branch Database Connections

```ts
// server/src/models/db.ts
export function getBranchModels(dbName: string): BranchModels {
  if (!branchModelCache.has(dbName)) {
    // useDb reuses the underlying connection pool
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    const models = registerModels(conn);
    branchModelCache.set(dbName, models);
  }
  return branchModelCache.get(dbName)!;
}
```

### Redis Connection

```ts
// server/src/services/cache.ts
export function initCache(redisUrl: string): Redis {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,       // Connect on first operation
    enableReadyCheck: true,  // Verify connection is ready
    connectTimeout: 10000,   // 10s timeout
  });
  return client;
}
```

### Anti-Pattern

```ts
// WRONG — creating new connection per request
router.get("/", asyncHandler(async (req, res) => {
  const conn = await mongoose.connect(MONGO_URI); // New connection every time!
  const list = await Customer.find();
  res.json({ success: true, data: list });
}));

// WRONG — no connection pooling configuration
await mongoose.connect(MONGO_URI); // Uses default pool size (5), may be too small
```

### Tradeoffs

- Mongoose handles pooling automatically — `mongoose.connect()` creates a connection pool.
- `useDb()` reuses the underlying connection — no new TCP connections for branch databases.
- `lazyConnect: true` for Redis means the connection is established on first cache
  operation, not at server startup.
- `maxRetriesPerRequest: 3` for Redis prevents infinite retry loops.

### Related Patterns

- Branch Database Models (database-patterns.md)
- Redis Service (section 3)

---

## 6. Parallel Execution Patterns

**Purpose:** Execute independent database queries concurrently using `Promise.all`.

**When to use:** Multiple independent queries that can run simultaneously.

### Dashboard — Massive Parallel Queries

```ts
// server/src/routes/dashboard.ts — 25+ parallel queries
const [customers, orders, bills, payments, inventory, deliveries, visits] = await Promise.all([
  Customer.countDocuments(),
  Order.countDocuments(),
  Bill.countDocuments(),
  Payment.countDocuments(),
  Inventory.countDocuments(),
  Delivery.countDocuments(),
  Visit.countDocuments(),
]);

// Then another batch of parallel queries
const [todaySales, todayCollection, weekSales, monthSales, ...] = await Promise.all([
  Bill.aggregate([
    { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]),
  Payment.aggregate([
    { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]),
  Bill.aggregate([
    { $match: { createdAt: { $gte: weekStart, $lt: today } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]),
  // ... 20+ more parallel queries
]);
```

### Customer Summary — Parallel Counts

```ts
// server/src/controllers/customerController.ts
const [visitCount, orderCount, billTotal] = await Promise.all([
  Visit.countDocuments({ customerId: req.params.id }),
  Order.countDocuments({ customerId: req.params.id }),
  Bill.aggregate([
    { $match: { customerId: req.params.id } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]),
]);
```

### Inventory Stats — Parallel Aggregation

```ts
// server/src/routes/inventory.ts
const [totalItems, lowStock, warehouseItems, totalValueResult] = await Promise.all([
  Inventory.countDocuments(),
  Inventory.countDocuments({ quantity: { $lte: 5 } }),
  Inventory.countDocuments({ location: "warehouse" }),
  Inventory.aggregate([
    { $group: { _id: null, total: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } } } },
  ]),
]);
```

### Cache Invalidation — Parallel Deletion

```ts
// server/src/routes/bills.ts
await Promise.all([
  invalidateCache("/api/bills"),
  invalidateCache("/api/dashboard"),
]);
```

### Anti-Pattern

```ts
// WRONG — sequential execution of independent queries
const customers = await Customer.countDocuments();
const orders = await Order.countDocuments();
const bills = await Bill.countDocuments();
// Takes 3x longer than Promise.all

// WRONG — Promise.all with dependent queries
const customer = await Customer.findById(id);
const orders = await Promise.all([
  Order.find({ customerId: customer._id }), // Depends on customer
  Bill.find({ customerId: customer._id }),  // Depends on customer
]);
```

### Tradeoffs

- `Promise.all` is used extensively in the dashboard route — 25+ parallel queries.
- All queries in `Promise.all` are independent — no data dependencies between them.
- Sequential execution would take 3-10x longer on the dashboard.
- Failed queries in `Promise.all` reject the entire batch — the global error handler
  catches this.

### Related Patterns

- Dashboard Route (api-patterns.md)
- Aggregation Patterns (database-patterns.md)

---

## 7. Batch Operation Patterns

**Purpose:** Perform bulk database operations efficiently instead of one at a time.

**When to use:** Operations that affect multiple documents.

### Batch Cache Invalidation with Pipeline

```ts
// server/src/services/cache.ts — Redis pipeline for batch deletion
export async function cacheDel(pattern: string): Promise<void> {
  const keys = await scanKeys(pattern);
  if (keys.length > 0) {
    const pipeline = client!.pipeline();
    keys.forEach((k) => pipeline.del(k));
    await pipeline.exec(); // Single round-trip for all deletions
  }
}
```

### Batch Cascade Delete

```ts
// server/src/controllers/customerController.ts — delete all related records
await Promise.all([
  Visit.deleteMany({ customerId }),
  Order.deleteMany({ customerId }),
  Bill.deleteMany({ customerId }),
  Prescription.deleteMany({ customerId }),
  Payment.deleteMany({ customerId }),
  Delivery.deleteMany({ customerId }),
]);
```

### Batch Cache Invalidation

```ts
// server/src/routes/payments.ts — invalidate multiple cache patterns
await Promise.all([
  invalidateCache("/api/payments"),
  invalidateCache("/api/bills"),
  invalidateCache("/api/dashboard"),
]);
```

### Batch Update with $inc

```ts
// server/src/routes/bills.ts — update customer totals atomically
const customerUpdates: Record<string, number> = {};
if (Math.abs(totalDiff) > 0.01) customerUpdates.totalSpent = totalDiff;
if (Math.abs(pendingDiff) > 0.01) customerUpdates.pendingAmount = pendingDiff;
if (Object.keys(customerUpdates).length > 0) {
  await Customer.findByIdAndUpdate(bill.customerId, { $inc: customerUpdates });
}
```

### Anti-Pattern

```ts
// WRONG — one-at-a-time deletion
for (const id of customerIds) {
  await Customer.findByIdAndDelete(id); // N queries
}

// RIGHT — batch deletion
await Customer.deleteMany({ _id: { $in: customerIds } }); // 1 query

// WRONG — sequential cache invalidation
await invalidateCache("/api/payments");
await invalidateCache("/api/bills");
await invalidateCache("/api/dashboard");
// Takes 3x longer than Promise.all
```

### Tradeoffs

- `deleteMany` is more efficient than looping `deleteOne` — single database round-trip.
- Redis pipeline batches multiple commands into a single round-trip — much faster.
- `$inc` is atomic — multiple fields can be incremented in a single operation.
- `Promise.all` for cache invalidation runs deletions in parallel.

### Related Patterns

- Cascade Operations (database-patterns.md)
- Redis Pipeline (section 3)

---

## 8. Projection Patterns

**Purpose:** Select only the fields needed for a response to reduce data transfer.

**When to use:** Every query that doesn't need all fields.

### Select Specific Fields

```ts
// server/src/routes/delivery.ts — only name and mobile from customer
const list = await Delivery.find(filter)
  .populate("customerId", "name mobile")      // Projection on populated field
  .populate("orderId", "frame lens status")   // Only needed order fields
  .sort({ createdAt: -1 })
  .limit(200)
  .lean();
```

### Exclude Sensitive Fields

```ts
// server/src/controllers/authController.ts — exclude password
const user = await User.findById(id).select("-passwordHash").lean();

// List users — exclude passwords
const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
```

### Select in Aggregate

```ts
// server/src/routes/orders.ts — select specific bill fields
const bill = await Bill.findOne({ customerId: custId })
  .sort({ createdAt: -1 })
  .select("pendingAmount totalAmount advancePaid billNumber");
```

### Minimal Fields for Existence Check

```ts
// server/src/routes/branches.ts — only active branches, exclude sensitive fields
const branches = await Branch.find({ isActive: true })
  .sort({ createdAt: 1 })
  .select("-dbName -settings")  // Don't expose database name or settings
  .lean();
```

### Anti-Pattern

```ts
// WRONG — fetching all fields when only a few are needed
const customer = await Customer.findById(id); // Fetches ALL fields including __v

// WRONG — no projection on populated fields
const orders = await Order.find().populate("customerId"); // Fetches all customer fields
```

### Tradeoffs

- `.select("field1 field2")` reduces the amount of data transferred from MongoDB.
- `.lean()` combined with projection is the most efficient query pattern.
- `-passwordHash` exclusion is critical for security — never return passwords.
- Projection is less important with `.lean()` since plain objects are lighter than
  Mongoose documents, but still reduces network transfer.

### Related Patterns

- Query Optimization (section 1)
- Security Patterns (security-patterns.md)

---

## 9. HTTP Compression Patterns

**Purpose:** Compress HTTP responses to reduce bandwidth and improve load times.

**When to use:** Applied globally to all responses.

### Compression Middleware

```ts
// server/src/app.ts
import compression from "compression";

app.use(compression({ level: 6, threshold: 1024 }));
```

### Static File Caching

```ts
// Long-term caching for hashed assets
app.use(express.static(distPath, {
  maxAge: "1y",
  immutable: true,  // Assets have content hashes in filenames
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));
```

### Anti-Pattern

```ts
// WRONG — no compression
// All JSON responses sent uncompressed

// WRONG — compressing already-compressed files
app.use(compression()); // Wastes CPU compressing .gz files
```

### Tradeoffs

- `level: 6` is a good balance between compression ratio and CPU usage.
- `threshold: 1024` only compresses responses larger than 1KB — small responses don't
  benefit from compression.
- Static assets are cached for 1 year with `immutable: true` — Vite content hashes
  ensure new versions are served when code changes.
- HTML files are set to `no-cache` — always check for updates.

### Related Patterns

- Static File Serving (security-patterns.md)
- Cache Headers (api-patterns.md)

---

## 10. Response Size Optimization Patterns

**Purpose:** Minimize response payloads to improve page load times.

**When to use:** Every API response.

### Limit Result Sets

```ts
// Fixed limits per resource
const orders = await Order.find(filter).limit(500);    // Max 500 orders
const inventory = await Inventory.find(filter).limit(200); // Max 200 items
const payments = await Payment.find(filter).limit(500);  // Max 500 payments
const visits = await Visit.find(filter).limit(200);     // Max 200 visits
```

### Lean Queries

```ts
// lean() returns plain objects instead of Mongoose documents
// 2-5x less memory, faster serialization
const list = await Customer.find(filter).sort({ createdAt: -1 }).lean();
```

### Select Needed Fields Only

```ts
// Don't fetch all fields when only a few are needed
const bill = await Bill.findOne({ customerId: custId })
  .sort({ createdAt: -1 })
  .select("pendingAmount totalAmount advancePaid billNumber");

// Don't populate all fields
const list = await Order.find(filter)
  .populate("customerId", "name mobile")  // Only name and mobile
  .sort({ createdAt: -1 })
  .limit(500);
```

### Client-Side Pagination

```tsx
// Table component paginates on the client
const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
// Only renders 10 rows at a time, even if 500 are loaded
```

### Anti-Pattern

```ts
// WRONG — no limits, fetching entire collections
const list = await Order.find(); // Could return 10,000+ documents

// WRONG — fetching all fields
const list = await Customer.find().populate("customerId"); // No field selection

// WRONG — not using lean()
const list = await Order.find(); // Full Mongoose documents
```

### Tradeoffs

- Fixed limits (500, 200) are appropriate for ERP datasets that are bounded.
- `lean()` is the single biggest performance improvement for read queries.
- Field selection reduces both database and network overhead.
- Client-side pagination means the initial load is slightly larger but navigation is instant.

### Related Patterns

- Query Optimization (section 1)
- Pagination Patterns (database-patterns.md)

---

## 11. Error Recovery Patterns

**Purpose:** Graceful degradation when external services (Redis, WhatsApp) are unavailable.

**When to use:** Interactions with external infrastructure.

### Cache Service Degradation

```ts
// server/src/services/cache.ts — Redis failure is non-fatal
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null; // Graceful degradation
  try {
    const raw = await client!.get(prefixed(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null; // Cache miss, not an error
  }
}

export async function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isConnected()) return; // Graceful degradation
  try {
    await client!.setex(prefixed(key), ttl, value);
  } catch (e) { /* set failure is non-fatal */ }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected()) return; // Graceful degradation
  try {
    // ... deletion logic
  } catch (e) { /* del failure is non-fatal */ }
}
```

### WhatsApp Service Degradation

```ts
// server/src/routes/bills.ts — WhatsApp notification is fire-and-forget
if (customer?.mobile) {
  (async () => {
    try {
      const wa = whatsappManager.getInstance(branchId);
      const settings = await Settings.findOne().lean();
      const pdfBuffer = generateBillPdf(/* ... */);
      await wa.sendMedia(customer.mobile, pdfBuffer.toString("base64"), /* ... */);
    } catch {
      // WhatsApp notification is optional — don't fail the bill creation
    }
  })();
}
```

### Order Status with Partial Advancement

```ts
// server/src/routes/orders.ts — handle partial quantity advancement
if (newForwarded >= qty) {
  order.status = status as any;
  order.forwardedCount = 0;
} else {
  order.forwardedCount = newForwarded; // Partial advancement
}
```

### Anti-Pattern

```ts
// WRONG — hard failure on cache miss
const cached = await cacheGet("key");
if (!cached) throw new Error("Cache miss"); // Crashes the request

// WRONG — synchronous WhatsApp call blocks response
await wa.sendMessage(phone, msg); // User waits for WhatsApp response
```

### Tradeoffs

- Cache failure degrades to direct database queries — slower but functional.
- WhatsApp failure doesn't affect the core business operation (bill creation, order update).
- Fire-and-forget WhatsApp uses an immediately-invoked async function — non-blocking.
- Partial advancement handles quantity > 1 orders gracefully.

### Related Patterns

- Cache Service (section 3)
- WhatsApp Service (backend-patterns.md)
