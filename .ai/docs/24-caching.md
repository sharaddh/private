# 24 — Caching

## Purpose

Caching reduces database load, improves response times, and provides a better user experience. The KMJ Optical ERP system uses a layered caching strategy: in-memory caching for hot data, Redis for distributed caching, and route-level caching for expensive queries. Caching is branch-aware — each branch sees only its own cached data. Without proper caching, every page load hits MongoDB, which doesn't scale.

## Core Principles

### 1. Cache Invalidation Is the Hard Part

There are only two hard things in computer science: cache invalidation and naming things. Get this wrong and you serve stale data. The KMJ ERP uses **event-driven invalidation** — when data changes, the corresponding cache entries are explicitly invalidated.

### 2. Branch-Aware Caching

Every cache key includes the branch ID. Branch A's cached customer list never interferes with Branch B's cached customer list. This is non-negotiable in a multi-tenant system.

### 3. Cache Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: In-Memory (process-level)     │  ← Fastest, limited to single server
├─────────────────────────────────────────┤
│  Layer 2: Redis (distributed)           │  ← Shared across server instances
├─────────────────────────────────────────┤
│  Layer 3: MongoDB                       │  ← Source of truth, slowest
└─────────────────────────────────────────┘
```

### 4. Graceful Degradation

If Redis is down, the system must work without caching. Cache is a performance optimization, not a requirement. Every cache read must handle the failure case.

## Detailed Rules

### Cache Service Implementation

```typescript
// server/src/services/cache.ts
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

class CacheService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return Math.min(retries * 200, 5000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.warn('Redis unavailable, using in-memory cache', {
        error: (error as Error).message
      });
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // ── Key Generation ──

  /**
   * Build a cache key with branch prefix.
   * All keys are prefixed with the branch ID for tenant isolation.
   *
   * Format: `kmj:{branchId}:{namespace}:{identifier}`
   * Example: `kmj:branch123:customers:list:page1`
   */
  buildKey(branchId: string, namespace: string, identifier: string): string {
    return `kmj:${branchId}:${namespace}:${identifier}`;
  }

  // ── Get/Set with fallback ──

  async get<T>(key: string): Promise<T | null> {
    // Layer 1: In-memory cache
    const memResult = this.getFromMemory<T>(key);
    if (memResult !== null) return memResult;

    // Layer 2: Redis
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          // Populate in-memory cache for faster subsequent reads
          this.setInMemory(key, parsed, 60); // 60s in-memory TTL
          return parsed;
        }
      } catch (error) {
        logger.warn('Redis get failed', { key, error: (error as Error).message });
      }
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const serialized = JSON.stringify(value);

    // Layer 1: In-memory
    this.setInMemory(key, value, Math.min(ttlSeconds, 60));

    // Layer 2: Redis
    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(key, ttlSeconds, serialized);
      } catch (error) {
        logger.warn('Redis set failed', { key, error: (error as Error).message });
      }
    }
  }

  async invalidate(key: string): Promise<void> {
    // Remove from in-memory
    this.memoryCache.delete(key);

    // Remove from Redis
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        logger.warn('Redis invalidate failed', { key, error: (error as Error).message });
      }
    }
  }

  /**
   * Invalidate all keys matching a pattern.
   * Uses Redis SCAN to avoid blocking the server.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Clear matching in-memory keys
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear matching Redis keys
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
          logger.info('Cache pattern invalidated', {
            pattern,
            count: keys.length
          });
        }
      } catch (error) {
        logger.warn('Redis pattern invalidation failed', {
          pattern,
          error: (error as Error).message
        });
      }
    }
  }

  // ── In-Memory Helpers ──

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setInMemory(key: string, value: any, ttlSeconds: number): void {
    // Limit in-memory cache size
    if (this.memoryCache.size > 1000) {
      // Remove oldest entries
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data: value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  // ── Health Check ──

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const cacheService = new CacheService();
```

### Cache Key Conventions

All cache keys follow a strict naming convention:

```
kmj:{branchId}:{namespace}:{identifier}
```

| Namespace | Identifier Pattern | TTL | Example |
|-----------|-------------------|-----|---------|
| `customers` | `list:{page}:{search}` | 300s | `kmj:b1:customers:list:1:` |
| `customers` | `detail:{id}` | 600s | `kmj:b1:customers:detail:c123` |
| `orders` | `list:{page}:{status}` | 120s | `kmj:b1:orders:list:1:pending` |
| `orders` | `detail:{id}` | 300s | `kmj:b1:orders:detail:o456` |
| `inventory` | `list:{page}` | 180s | `kmj:b1:inventory:list:1` |
| `inventory` | `low-stock` | 60s | `kmj:b1:inventory:low-stock` |
| `dashboard` | `summary` | 60s | `kmj:b1:dashboard:summary` |
| `reports` | `sales:{dateRange}` | 300s | `kmj:b1:reports:sales:2024-01` |
| `bills` | `list:{page}` | 120s | `kmj:b1:bills:list:1` |
| `payments` | `summary:{date}` | 180s | `kmj:b1:payments:summary:2024-01-15` |
| `users` | `me:{userId}` | 3600s | `kmj:b1:users:me:u789` |

### Route-Level Caching Middleware

```typescript
// server/src/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache';
import { getActiveBranchId } from './branch';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number;           // Time-to-live in seconds
  namespace: string;      // Cache namespace (e.g., 'customers', 'orders')
  keyBuilder?: (req: Request) => string;  // Custom key builder
  skipCache?: (req: Request) => boolean;  // Condition to skip cache
}

export function routeCache(options: CacheOptions) {
  const { ttl = 300, namespace, keyBuilder, skipCache } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if condition met
    if (skipCache && skipCache(req)) {
      return next();
    }

    const branchId = getActiveBranchId();
    if (!branchId) {
      return next(); // No branch context, don't cache
    }

    // Build cache key
    const identifier = keyBuilder
      ? keyBuilder(req)
      : buildDefaultKey(req);

    const cacheKey = cacheService.buildKey(branchId, namespace, identifier);

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        // Serve from cache
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.json(cached);
        return;
      }
    } catch (error) {
      logger.warn('Cache read failed, proceeding to DB', {
        key: cacheKey,
        error: (error as Error).message
      });
    }

    // Cache miss — intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(cacheKey, body, ttl).catch((err) => {
          logger.warn('Cache write failed', {
            key: cacheKey,
            error: err.message
          });
        });
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

function buildDefaultKey(req: Request): string {
  const params = JSON.stringify(req.query);
  const hash = simpleHash(params);
  return `${req.path}:${hash}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
```

### Using Cache Middleware in Routes

```typescript
// server/src/routes/customers.ts
import { routeCache } from '../middleware/cache';

// Cache customer list for 5 minutes
router.get('/',
  authenticate,
  requireBranchAccess,
  routeCache({
    ttl: 300,
    namespace: 'customers',
    keyBuilder: (req) => {
      const page = req.query.page || '1';
      const search = req.query.search || '';
      const sort = req.query.sort || 'name';
      return `list:${page}:${search}:${sort}`;
    }
  }),
  customerController.list
);

// Cache individual customer for 10 minutes
router.get('/:id',
  authenticate,
  requireBranchAccess,
  routeCache({
    ttl: 600,
    namespace: 'customers',
    keyBuilder: (req) => `detail:${req.params.id}`
  }),
  customerController.getById
);

// POST/PUT/DELETE invalidate cache automatically
router.post('/',
  authenticate,
  requireBranchAccess,
  validate(customerSchema),
  async (req, res, next) => {
    await customerController.create(req, res, next);
    // Invalidate customer list cache
    const branchId = getActiveBranchId();
    if (branchId) {
      await cacheService.invalidatePattern(`kmj:${branchId}:customers:list:*`);
    }
  }
);
```

### Controller-Level Cache Invalidation

```typescript
// server/src/controllers/customerController.ts
import { cacheService } from '../services/cache';
import { getActiveBranchId } from '../middleware/branch';

export const customerController = {
  async create(req: Request, res: Response, next: NextFunction) {
    const branchId = getActiveBranchId();
    const customer = await Customer.create({
      ...req.body,
      branch: branchId
    });

    // Invalidate list caches
    await cacheService.invalidatePattern(`kmj:${branchId}:customers:list:*`);
    // Invalidate dashboard (customer count changed)
    await cacheService.invalidatePattern(`kmj:${branchId}:dashboard:*`);

    res.status(201).json(successResponse(customer));
  },

  async update(req: Request, res: Response, next: NextFunction) {
    const branchId = getActiveBranchId();
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, branch: branchId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      throw new ApiError('Customer not found', 404, 'NOT_FOUND');
    }

    // Invalidate both list and detail caches
    await cacheService.invalidatePattern(`kmj:${branchId}:customers:list:*`);
    await cacheService.invalidate(cacheService.buildKey(branchId, 'customers', `detail:${req.params.id}`));

    res.json(successResponse(customer));
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    const branchId = getActiveBranchId();
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      branch: branchId
    });

    if (!customer) {
      throw new ApiError('Customer not found', 404, 'NOT_FOUND');
    }

    // Invalidate all customer-related caches
    await cacheService.invalidatePattern(`kmj:${branchId}:customers:*`);
    await cacheService.invalidatePattern(`kmj:${branchId}:orders:*`);
    await cacheService.invalidatePattern(`kmj:${branchId}:dashboard:*`);

    res.json(successResponse({ message: 'Customer deleted' }));
  }
};
```

### Dashboard Caching (Expensive Queries)

```typescript
// server/src/controllers/dashboardController.ts
import { cacheService } from '../services/cache';

export const dashboardController = {
  async getSummary(req: Request, res: Response) {
    const branchId = getActiveBranchId();
    const cacheKey = cacheService.buildKey(branchId, 'dashboard', 'summary');

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Expensive aggregation queries
    const [
      totalCustomers,
      totalOrders,
      pendingOrders,
      revenue,
      lowStockItems
    ] = await Promise.all([
      Customer.countDocuments({ branch: branchId }),
      Order.countDocuments({ branch: branchId }),
      Order.countDocuments({ branch: branchId, status: 'pending' }),
      Payment.aggregate([
        { $match: { branch: new mongoose.Types.ObjectId(branchId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Inventory.countDocuments({
        branch: branchId,
        $expr: { $lte: ['$quantity', '$reorderLevel'] }
      })
    ]);

    const summary = {
      totalCustomers,
      totalOrders,
      pendingOrders,
      totalRevenue: revenue[0]?.total || 0,
      lowStockItems,
      lastUpdated: new Date().toISOString()
    };

    // Cache for 60 seconds
    await cacheService.set(cacheKey, summary, 60);

    res.json(successResponse(summary));
  }
};
```

### Report Caching (Long TTL)

```typescript
// server/src/controllers/reportController.ts
export const reportController = {
  async getSalesReport(req: Request, res: Response) {
    const branchId = getActiveBranchId();
    const { from, to, groupBy } = req.query;

    const cacheKey = cacheService.buildKey(
      branchId,
      'reports',
      `sales:${from}:${to}:${groupBy || 'daily'}`
    );

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Complex aggregation pipeline
    const salesData = await Payment.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(branchId),
          date: {
            $gte: new Date(from as string),
            $lte: new Date(to as string)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy === 'monthly' ? '%Y-%m' : '%Y-%m-%d',
              date: '$date'
            }
          },
          totalSales: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const report = {
      period: { from, to },
      groupBy: groupBy || 'daily',
      data: salesData,
      generatedAt: new Date().toISOString()
    };

    // Cache reports for 5 minutes
    await cacheService.set(cacheKey, report, 300);

    res.json(successResponse(report));
  }
};
```

### Cache Warming

Pre-populate cache for frequently accessed data on server startup:

```typescript
// server/src/utils/cacheWarmer.ts
import { cacheService } from '../services/cache';
import Branch from '../models/branch';
import { logger } from './logger';

export async function warmCache(): Promise<void> {
  try {
    const branches = await Branch.find({ isActive: true });
    let warmedCount = 0;

    for (const branch of branches) {
      const branchId = branch._id.toString();

      // Warm dashboard cache
      const dashboardKey = cacheService.buildKey(branchId, 'dashboard', 'summary');
      const existing = await cacheService.get(dashboardKey);
      if (!existing) {
        // Pre-compute and cache dashboard data
        await warmDashboardCache(branchId);
        warmedCount++;
      }
    }

    logger.info('Cache warming complete', { branchesWarmed: warmedCount });
  } catch (error) {
    logger.warn('Cache warming failed', { error: (error as Error).message });
  }
}

async function warmDashboardCache(branchId: string): Promise<void> {
  // Compute dashboard data and cache it
  // This avoids the first user hitting slow aggregation queries
  const cacheKey = cacheService.buildKey(branchId, 'dashboard', 'summary');
  // ... compute and set ...
}
```

### Cache Monitoring

```typescript
// server/src/middleware/cacheMonitor.ts
import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache';

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  lastReset: Date;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  lastReset: new Date()
};

export function cacheMonitor(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    const cacheHeader = res.getHeader('X-Cache');
    if (cacheHeader === 'HIT') {
      stats.hits++;
    } else if (cacheHeader === 'MISS') {
      stats.misses++;
    }
    return originalJson(body);
  };

  next();
}

// Expose cache stats endpoint (admin only)
export function getCacheStats(): CacheStats & { hitRate: number } {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? (stats.hits / total) * 100 : 0
  };
}

// Reset stats periodically
setInterval(() => {
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
  stats.lastReset = new Date();
}, 3600000); // Every hour
```

## Examples

### Example: Cache Headers in HTTP Response

```typescript
// Client-side cache awareness
// client/src/api.ts

// The frontend can read X-Cache headers for debugging
const response = await fetch('/api/customers?page=1', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-branch-id': branchId
  }
});

const cacheStatus = response.headers.get('X-Cache');
if (cacheStatus === 'HIT') {
  console.log('Served from cache');
}
```

### Example: Cache Invalidation Chain

```
User updates customer "John Doe"
  → PUT /api/customers/:id
  → Controller updates MongoDB
  → Invalidates: kmj:{branch}:customers:*
  → Invalidates: kmj:{branch}:dashboard:*
  → Next GET /api/customers → Cache MISS → Fresh data from MongoDB
  → Next GET /api/dashboard → Cache MISS → Fresh aggregation
```

## Bad Examples

### Bad: No Branch Prefix in Cache Key

```typescript
// ❌ BAD - Branch A's data pollutes Branch B's cache
const cacheKey = `customers:list:${page}`;
await cacheService.set(cacheKey, customerList, 300);

// ✅ GOOD - Branch-scoped cache key
const branchId = getActiveBranchId();
const cacheKey = cacheService.buildKey(branchId, 'customers', `list:${page}`);
await cacheService.set(cacheKey, customerList, 300);
```

### Bad: Caching Without Invalidation

```typescript
// ❌ BAD - Cache never invalidated, always stale
router.get('/customers', routeCache({ ttl: 3600 }), controller.list);
router.post('/customers', controller.create); // No invalidation!

// ✅ GOOD - Invalidate on write
router.get('/customers', routeCache({ ttl: 300 }), controller.list);
router.post('/customers', async (req, res, next) => {
  await controller.create(req, res, next);
  await cacheService.invalidatePattern(`kmj:${branchId}:customers:list:*`);
});
```

### Bad: Throwing on Cache Failure

```typescript
// ❌ BAD - Cache failure crashes the request
async function getCustomers(branchId: string, page: number) {
  const cached = await cacheService.get(key);
  if (cached) return cached;

  const data = await Customer.find({ branch: branchId });
  await cacheService.set(key, data, 300); // throws if Redis is down!
  return data;
}

// ✅ GOOD - Cache failure is non-fatal
async function getCustomers(branchId: string, page: number) {
  const cached = await cacheService.get(key);
  if (cached) return cached;

  const data = await Customer.find({ branch: branchId });

  try {
    await cacheService.set(key, data, 300);
  } catch (error) {
    logger.warn('Cache write failed', { error: error.message });
    // Continue without caching — data is still served
  }

  return data;
}
```

### Bad: Caching Authentication/Authorization Data

```typescript
// ❌ BAD - Never cache auth decisions
const cachedUser = await cacheService.get(`user:${userId}`);
if (cachedUser) return cachedUser; // Could be a revoked token!

// ✅ GOOD - Auth data is short-lived or not cached at all
// JWT validation is stateless and fast — no cache needed
// User permissions are checked on every request via JWT payload
```

## Tradeoffs

### In-Memory vs Redis

| Approach | Pros | Cons |
|----------|------|------|
| **In-Memory** | Ultra-fast (ns), no network | Lost on restart, single-process only |
| **Redis** | Shared, persistent, fast (ms) | Network overhead, requires infrastructure |
| **Both (layered)** | Best of both | Complexity, memory usage |

**Decision**: Use both. In-memory for hot paths (dashboard summary, active user data). Redis for shared state across server instances.

### Cache TTL Strategy

| Data Type | TTL | Reasoning |
|-----------|-----|-----------|
| Dashboard summary | 60s | Changes frequently, expensive to compute |
| Customer list | 300s | Changes moderately, expensive pagination |
| Customer detail | 600s | Changes infrequently, cheap to fetch |
| Order list | 120s | Changes frequently (new orders) |
| Reports | 300s | Expensive aggregation, moderate staleness acceptable |
| User profile | 3600s | Rarely changes, cheap to fetch |
| Low stock alerts | 60s | Safety critical, must be fresh |

### Cache Stampede Prevention

When a popular cache entry expires, many requests may hit the database simultaneously. Prevent with:

```typescript
// Simple lock-based approach
async function getOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = await cacheService.get<T>(key);
  if (cached) return cached;

  // Use a lock key to prevent stampede
  const lockKey = `lock:${key}`;
  const acquired = await cacheService.set(lockKey, '1', 10); // 10s lock

  if (!acquired) {
    // Another request is loading, wait and retry
    await new Promise(r => setTimeout(r, 100));
    return getOrLoad(key, loader, ttl);
  }

  try {
    const data = await loader();
    await cacheService.set(key, data, ttl);
    return data;
  } finally {
    await cacheService.invalidate(lockKey);
  }
}
```

## Cross-References

- **11-caching.md** — Original caching rules (this file expands on implementation)
- **06-architecture.md** — System architecture including Redis integration
- **10-multi-tenancy.md** — Branch isolation requirements for cache keys
- **20-logging.md** — Cache hit/miss logging
- **21-performance.md** — Cache as a performance optimization
- **22-security.md** — Never cache sensitive data
- **23-testing.md** — Mocking cache service in tests

## AI Instructions

1. **Always include branch ID in cache keys** — `kmj:{branchId}:{namespace}:{identifier}`. Never use global cache keys.
2. **Always invalidate on write** — after create/update/delete, invalidate relevant cache patterns.
3. **Handle cache failures gracefully** — catch errors, log warnings, serve from DB. Cache is optimization, not requirement.
4. **Set appropriate TTLs** — 60s for frequently changing data, 300s for moderately changing, 3600s for rarely changing.
5. **Never cache auth decisions** — JWT validation is stateless. Don't cache token validity or user permissions.
6. **Never cache sensitive data** — passwords, payment details, personal identification numbers must never be cached.
7. **Use `invalidatePattern` for list caches** — when any item in a list changes, invalidate all page variants.
8. **Monitor cache hit rates** — low hit rates indicate poor TTL choices or over-caching.
9. **Prefer route-level caching** — apply `routeCache` middleware for expensive GET endpoints. Use controller-level caching only for complex multi-query operations.
10. **Test cache invalidation** — every write operation test should verify that related cache entries are invalidated.
