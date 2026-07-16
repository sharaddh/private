# 21 - Performance

## Purpose

This document defines performance optimization patterns for the KMJ Optical ERP, including database query optimization, indexing, caching, connection pooling, pagination, lazy loading, memoization, and bundle optimization.

## Performance Architecture

### Performance Layers

```
1. Database Layer
   ├── Indexing (compound indexes)
   ├── Query optimization (lean, projections)
   ├── Connection pooling
   └── Aggregation pipelines

2. Cache Layer
   ├── Redis caching (route-level)
   ├── In-memory caching
   └── Client-side caching

3. Network Layer
   ├── Compression (gzip)
   ├── Rate limiting
   └── Connection keep-alive

4. Frontend Layer
   ├── Code splitting
   ├── Lazy loading
   ├── Memoization
   └── Bundle optimization
```

## Database Optimization

### Connection Pooling

```typescript
// server/src/index.ts
await connect(MONGO_URI, {
  maxPoolSize: 10,                   // Connection pool size
  serverSelectionTimeoutMS: 5000,    // Fail fast
  socketTimeoutMS: 45000,            // Close idle sockets
});
```

### Connection Pool Rules

1. **Always configure pool size** (default 10)
2. **Always set server selection timeout** (5s)
3. **Always set socket timeout** (45s)
4. **Reuse connections** across requests
5. **Close idle connections** promptly

### Indexing Strategy

```typescript
// Customer indexes
customerSchema.index({ customerId: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ mobile: 1 });
customerSchema.index({ totalSpent: -1 });
customerSchema.index({ createdAt: -1 });

// Order indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ classification: 1, createdAt: -1 });

// Bill indexes
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ customerId: 1, createdAt: -1 });
billSchema.index({ pendingAmount: 1 });
```

### Index Rules

1. **Always index fields** used in queries
2. **Always use compound indexes** for multi-field queries
3. **Always put selective fields first** in compound indexes
4. **Never over-index** (each index slows writes)
5. **Monitor index usage** with `explain()`

### Query Optimization

#### Lean Queries

```typescript
// BAD: Returns full Mongoose documents
const customers = await Customer.find();

// GOOD: Returns plain JavaScript objects
const customers = await Customer.find().lean();
```

#### Projections

```typescript
// BAD: Returns all fields
const customer = await Customer.findById(id);

// GOOD: Returns only needed fields
const customer = await Customer.findById(id).select("name mobile totalSpent");
```

#### Batch Queries (Avoid N+1)

```typescript
// BAD: N+1 query problem
const customers = await Customer.find();
for (const c of customers) {
  c.orders = await Order.find({ customerId: c._id });
}

// GOOD: Batch query
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });
```

#### Parallel Queries

```typescript
// BAD: Sequential queries
const customers = await Customer.find();
const orders = await Order.find();
const bills = await Bill.find();

// GOOD: Parallel queries
const [customers, orders, bills] = await Promise.all([
  Customer.find(),
  Order.find(),
  Bill.find(),
]);
```

### Aggregation Pipelines

```typescript
// Efficient aggregation for dashboard stats
const todaySales = await Bill.aggregate([
  { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
  { $group: { _id: null, total: { $sum: "$totalAmount" } } },
]);

// Monthly sales trend
const dailySales = await Bill.aggregate([
  { $match: { createdAt: { $gte: thirtyDaysAgo, $lt: tomorrow } } },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      total: { $sum: "$totalAmount" },
    },
  },
  { $sort: { _id: 1 } },
]);
```

### Pagination

```typescript
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 1000;
const skip = (page - 1) * limit;

const [data, total] = await Promise.all([
  Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  Customer.countDocuments(filter),
]);

return success(res, {
  data,
  total,
  page,
  pages: Math.ceil(total / limit),
});
```

## Cache Optimization

### Redis Caching

```typescript
// Route-level caching
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

### Cache TTLs

| Data | TTL | Reason |
|------|-----|--------|
| Dashboard | 30s | Frequently updated |
| Orders | 30s | Frequently updated |
| Bills | 30s | Frequently updated |
| Payments | 30s | Frequently updated |
| Customers | 60s | Less frequently updated |
| Inventory | 60s | Less frequently updated |
| Reports (revenue) | 60s | Medium frequency |
| Reports (monthly) | 120s | Less frequently updated |

### Cache Invalidation

```typescript
export async function invalidateCache(pattern: string): Promise<void> {
  await cacheDel(pattern);
  // Also invalidate dashboard since most mutations affect it
  if (!pattern.includes("/dashboard")) {
    await cacheDel("*:/api/dashboard*");
  }
}
```

### Cache Invalidation Rules

1. **Always invalidate on mutations** (POST, PUT, DELETE)
2. **Always invalidate related caches** (e.g., bills mutation invalidates dashboard)
3. **Use fire-and-forget** for non-critical invalidation
4. **Use await** for critical invalidation
5. **Never cache sensitive data**
6. **Never cache error responses**

### Graceful Degradation

```typescript
// Redis unavailable - continue without cache
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
```

## Network Optimization

### Compression

```typescript
// server/src/app.ts
app.use(compression({
  level: 6,         // Compression level (1-9)
  threshold: 1024,  // Only compress responses > 1KB
}));
```

### Static File Caching

```typescript
// Long cache for static assets
app.use(express.static(distPath, {
  maxAge: "1y",
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));
```

### Rate Limiting

```typescript
app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 200,              // 200 requests per minute
  standardHeaders: true,
}));
```

## Frontend Optimization

### Code Splitting

```typescript
// Lazy load routes
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const Orders = lazy(() => import("./pages/Orders"));
```

### Memoization

```typescript
// React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  // Expensive rendering logic
  return <div>{/* ... */}</div>;
});

// useMemo for expensive computations
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.totalSpent - a.totalSpent);
}, [data]);

// useCallback for stable function references
const handleClick = useCallback(() => {
  // Handle click
}, [dependency]);
```

### Debouncing

```typescript
// Debounce search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

### Abort Controllers

```typescript
// Cancel previous requests
let abortController: AbortController | null = null;

async function fetchCustomers(search: string) {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const response = await fetch(`/api/customers?search=${search}`, {
      signal: abortController.signal,
    });
    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") return null;
    throw err;
  }
}
```

## Dashboard Performance

### Current Issue: N+1 Queries

The dashboard endpoint executes 23+ queries in a single request:

```typescript
// server/src/routes/dashboard.ts
const [customers, orders, bills, payments, inventory, deliveries, visits, ...] =
  await Promise.all([
    Customer.countDocuments(),
    Order.countDocuments(),
    Bill.countDocuments(),
    // ... 20+ more queries
  ]);
```

### Optimization Strategies

1. **Cache aggressively** (30s TTL for dashboard)
2. **Use aggregation pipelines** for complex calculations
3. **Denormalize frequently accessed data**
4. **Consider materialized views** for complex reports
5. **Lazy-load dashboard sections** on client side

## Performance Monitoring

### Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API response time | < 200ms | Varies |
| Database query time | < 50ms | Varies |
| Cache hit rate | > 80% | Unknown |
| Page load time | < 3s | Varies |
| Time to interactive | < 5s | Varies |

### Performance Rules

1. **Always use indexes** for query fields
2. **Always use lean()** for read-only queries
3. **Always use projections** to limit fields
4. **Always cache GET responses** with appropriate TTL
5. **Always invalidate cache** on mutations
6. **Always use pagination** for list queries
7. **Always use parallel queries** when possible
8. **Never use N+1 queries**
9. **Never cache sensitive data**
10. **Never skip error handling** for performance

## Bad Examples

```typescript
// BAD: N+1 query
const customers = await Customer.find();
for (const c of customers) {
  c.orders = await Order.find({ customerId: c._id });
}

// BAD: No lean() for read-only
const customers = await Customer.find().sort({ createdAt: -1 });

// BAD: No projection
const customer = await Customer.findById(id); // Returns all fields

// BAD: Sequential queries
const customers = await Customer.find();
const orders = await Order.find();
const bills = await Bill.find();

// BAD: No caching
router.get("/", authenticate, asyncHandler(handler)); // No cacheRoute

// BAD: Caching mutations
router.post("/", authenticate, cacheRoute(60), asyncHandler(handler));
```

## Good Examples

```typescript
// GOOD: Batch query
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });

// GOOD: Lean queries
const customers = await Customer.find().sort({ createdAt: -1 }).lean();

// GOOD: Projection
const customer = await Customer.findById(id).select("name mobile totalSpent");

// GOOD: Parallel queries
const [customers, orders, bills] = await Promise.all([
  Customer.find(),
  Order.find(),
  Bill.find(),
]);

// GOOD: Caching
router.get("/", authenticate, branchScope, cacheRoute(60), asyncHandler(handler));

// GOOD: Pagination
const [data, total] = await Promise.all([
  Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  Customer.countDocuments(filter),
]);
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Redis caching | Fast reads | Cache invalidation complexity |
| Lean queries | Better performance | No Mongoose document methods |
| Parallel queries | Faster response | More complex error handling |
| Aggregation pipelines | Efficient calculations | Complex to write/maintain |
| Code splitting | Smaller bundles | More complex routing |
| Debouncing | Fewer requests | Delayed feedback |

## Cross-References

- **Database patterns**: See `docs/13-mongodb.md`
- **Caching**: See `docs/24-caching.md`
- **Security**: See `docs/22-security.md`
- **Backend patterns**: See `docs/07-backend.md`
- **Express patterns**: See `docs/11-express.md`

## AI Instructions

When optimizing performance:
1. Always use indexes for query fields
2. Always use lean() for read-only queries
3. Always use projections to limit fields
4. Always cache GET responses with appropriate TTL
5. Always invalidate cache on mutations
6. Always use pagination for list queries
7. Always use parallel queries when possible
8. Never use N+1 queries
9. Always profile before optimizing
10. Always run linting after changes
