# API Design Patterns — KMJ Optical ERP

> Reference guide for all HTTP API conventions used across the KMJ Optical ERP backend.

---

## 1. Standard JSON Response Format

**Purpose:** Every API endpoint returns a consistent envelope so the frontend can always
parse the same shape regardless of resource or status code.

**When to use:** Every single route handler that returns JSON.

### Success Response

```json
{ "success": true, "data": { ... } }
```

### Created Response (HTTP 201)

```json
{ "success": true, "data": { ... }, "message": "Created successfully" }
```

### Failure Response

```json
{ "success": false, "message": "Customer not found" }
```

### With Extra Metadata

```json
{ "success": true, "data": [...], "total": 42, "page": 1, "pages": 3 }
```

### Code Example — `server/src/utils/response.ts`

```ts
import { Response } from "express";

export function success(res: Response, data: unknown, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created(res: Response, data: unknown, message = "Created successfully") {
  return success(res, data, message, 201);
}

export function fail(res: Response, message: string, status = 400, extra?: Record<string, unknown>) {
  return res.status(status).json({ success: false, message, ...extra });
}

export function notFound(res: Response, message = "Resource not found") {
  return fail(res, message, 404);
}

export function serverError(res: Response, error: unknown) {
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
}
```

### Code Example — Inline (most routes)

```ts
// GET — success
res.json({ success: true, data: enriched });

// POST — success
res.json({ success: true, data: order });

// DELETE — success
res.json({ success: true, message: "Deleted" });

// Not found
return res.status(404).json({ success: false, message: "Not found" });

// Validation / bad request
return res.status(400).json({ success: false, message: err.message });
```

### Anti-Pattern

```ts
// WRONG — inconsistent shapes depending on route
res.json({ ok: true, result: data });
res.json({ status: "success", payload: data });
res.send(data); // no envelope at all
```

### Tradeoffs

- The `success` boolean lets frontend do `if (res.success)` instead of checking HTTP codes.
- The response helpers (`success`, `created`, `fail`, `notFound`) reduce boilerplate but some
  routes still use inline `res.json` — pick one style per route.
- Extra fields (`total`, `page`, `pages`) are only present on list endpoints.

### Related Patterns

- Pagination Patterns (section 3)
- Error Response Patterns (section 5)

---

## 2. RESTful Endpoint Patterns

**Purpose:** Define the URL structure for every resource in the ERP.

**When to use:** All resource CRUD operations follow these conventions.

### Route Table

| Method | Path | Description | Middleware |
|--------|------|-------------|------------|
| GET | `/api/customers` | List all customers | authenticate, cacheRoute(60) |
| POST | `/api/customers` | Create customer | authenticate, audit |
| GET | `/api/customers/:id` | Get single customer | authenticate |
| PUT | `/api/customers/:id` | Update customer | authenticate |
| DELETE | `/api/customers/:id` | Delete customer | authenticate |
| GET | `/api/customers/summary/:id` | Get customer with stats | authenticate, cacheRoute(30) |
| GET | `/api/orders` | List orders | authenticate, cacheRoute(30) |
| POST | `/api/orders` | Create order | authenticate, audit |
| GET | `/api/orders/:id` | Get single order | authenticate |
| PUT | `/api/orders/:id` | Update order | authenticate, audit |
| PATCH | `/api/orders/:id/status` | Partial status update | authenticate |
| PATCH | `/api/orders/:id/classify` | Set classification | authenticate |
| DELETE | `/api/orders/:id` | Delete order | authenticate, audit |
| POST | `/api/orders/demand-send` | Generate & send PDF | authenticate |

### Code Example — `server/src/routes/customers.ts`

```ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { cacheRoute, invalidateCache } from "../middleware/cache";
import { asyncHandler } from "../middleware/asyncHandler";
import * as customerController from "../controllers/customerController";

const router = Router();

router.get("/",    authenticate, cacheRoute(60), asyncHandler(customerController.getAll));
router.post("/",   authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.create(req, res);
}));
router.get("/summary/:id", authenticate, cacheRoute(30), asyncHandler(customerController.getSummary));
router.get("/:id", authenticate, asyncHandler(customerController.getById));
router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.update(req, res);
}));
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.remove(req, res);
}));

export default router;
```

### Anti-Pattern

```ts
// WRONG — non-RESTful naming
router.get("/getCustomers", ...);
router.post("/addNewCustomer", ...);
router.post("/deleteCustomerById", ...);
```

### Tradeoffs

- `GET /:id` vs `GET /summary/:id` — the summary route is placed before the catch-all `/:id`
  to avoid matching. This is the correct Express ordering.
- `PATCH` is used for partial updates (status, classification); `PUT` for full replacements.
- Some routes (orders) embed complex business logic inline rather than in a controller —
  this is intentional for routes that cross multiple models.

### Related Patterns

- Branch Scoping (section 7)
- Cache Invalidation (section 6)

---

## 3. Pagination Patterns

**Purpose:** Return large result sets in pages with metadata for the frontend to display
"Showing 1-100 of 423 customers" style pagination.

**When to use:** List endpoints that can return hundreds or thousands of records.

### Request

```
GET /api/customers?page=1&limit=1000
```

### Response

```json
{
  "success": true,
  "data": [ ... ],
  "total": 423,
  "page": 1,
  "pages": 1
}
```

### Code Example — `server/src/controllers/customerController.ts`

```ts
export async function getAll(req: Request, res: Response) {
  const { phone, search, page = "1", limit = "1000" } = req.query;
  const filter: any = {};
  if (phone) filter.mobile = { $regex: phone as string, $options: "i" };
  if (search) {
    const s = String(search).trim();
    const searchRegex = { $regex: escapeRegex(s), $options: "i" };
    filter.$or = [
      { name: searchRegex },
      { mobile: searchRegex },
      { customerId: searchRegex },
      { email: searchRegex },
      { alternateMobile: searchRegex },
      { city: searchRegex },
    ];
  }
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
    Customer.countDocuments(filter),
  ]);
  return success(res, {
    data,
    total,
    page: parseInt(page as string),
    pages: Math.ceil(total / parseInt(limit as string)),
  });
}
```

### Simpler Pattern — Limit Only (most routes)

Most list endpoints do NOT use skip/limit pagination. They use a fixed `.limit(500)` or
`.limit(200)` cap and let the frontend handle client-side filtering:

```ts
// Orders, Bills, Payments — fixed limit
const list = await Order.find(filter)
  .populate("customerId", "name mobile")
  .sort({ createdAt: -1 })
  .limit(500);

res.json({ success: true, data: enriched });
```

```ts
// Inventory — smaller cap
const list = await Inventory.find(filter).limit(200).lean();
res.json({ success: true, data: list });
```

### Anti-Pattern

```ts
// WRONG — no limit at all, could return thousands of documents
const list = await Order.find(filter).sort({ createdAt: -1 });
res.json({ success: true, data: list });
```

### Tradeoffs

- Full skip/limit pagination (customers controller) is correct for search-heavy pages
  but adds complexity (`countDocuments` + `skip`).
- Fixed-limit `.limit(500)` is simpler and works well when datasets are bounded (optical
  shops rarely have >500 orders per branch).
- Always use `.lean()` with large lists to avoid Mongoose document overhead.

### Related Patterns

- Search/Filter Patterns (section 4)
- Projection Patterns (performance-patterns.md)

---

## 4. Search & Filter Patterns

**Purpose:** Allow the frontend to narrow down lists via query parameters.

**When to use:** Any list endpoint that the user can search or filter.

### Query Parameter Conventions

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `search` | string | `?search=Rahul` | Full-text regex across multiple fields |
| `phone` | string | `?phone=9876` | Mobile number substring |
| `q` | string | `?q=ray-ban` | Generic search (inventory) |
| `status` | string | `?status=Ready` | Enum filter |
| `customerId` | string | `?customerId=abc123` | Foreign key filter |
| `startDate` | ISO date | `?startDate=2024-01-01` | Date range start |
| `endDate` | ISO date | `?endDate=2024-12-31` | Date range end |
| `dateField` | string | `?dateField=deliveryDate` | Which date field to filter |

### Code Example — Regex Search (Inventory)

```ts
// server/src/routes/inventory.ts
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", authenticate, cacheRoute(60), asyncHandler(async (req, res) => {
  const q = (req.query.q as string) || "";
  const filter = q
    ? {
        $or: [
          { sku: { $regex: escapeRegex(q), $options: "i" } },
          { brand: { $regex: escapeRegex(q), $options: "i" } },
          { model: { $regex: escapeRegex(q), $options: "i" } },
          { category: { $regex: escapeRegex(q), $options: "i" } },
          { supplier: { $regex: escapeRegex(q), $options: "i" } },
        ],
      }
    : {};
  const list = await Inventory.find(filter).limit(200).lean();
  res.json({ success: true, data: list });
}));
```

### Code Example — Multi-Field Search (Customers)

```ts
// server/src/controllers/customerController.ts
if (search) {
  const s = String(search).trim();
  const searchRegex = { $regex: escapeRegex(s), $options: "i" };
  filter.$or = [
    { name: searchRegex },
    { mobile: searchRegex },
    { customerId: searchRegex },
    { email: searchRegex },
    { alternateMobile: searchRegex },
    { city: searchRegex },
  ];
}
```

### Code Example — Date Range Filter (Orders)

```ts
// server/src/routes/orders.ts
if (startDate || endDate) {
  const field = (dateField as string) || "createdAt";
  filter[field] = {};
  if (startDate) {
    const s = new Date(startDate as string);
    s.setHours(0, 0, 0, 0);
    filter[field].$gte = s;
  }
  if (endDate) {
    const e = new Date(endDate as string);
    e.setHours(23, 59, 59, 999);
    filter[field].$lte = e;
  }
}
```

### Code Example — Multiple Filter Fields (Bills)

```ts
// server/src/routes/bills.ts
const { customerId, startDate, endDate } = req.query;
const filter: Record<string, unknown> = {};
if (customerId) filter.customerId = customerId;
if (startDate || endDate) {
  filter.createdAt = {};
  if (startDate) {
    const s = new Date(startDate as string);
    s.setHours(0, 0, 0, 0);
    (filter.createdAt as Record<string, unknown>).$gte = s;
  }
  if (endDate) {
    const e = new Date(endDate as string);
    e.setHours(23, 59, 59, 999);
    (filter.createdAt as Record<string, unknown>).$lte = e;
  }
}
```

### Anti-Pattern

```ts
// WRONG — no escapeRegex, vulnerable to regex injection
const filter = { sku: { $regex: q, $options: "i" } };

// WRONG — building filter from unsanitized user input
const filter = JSON.parse(req.query.filter as string);
```

### Tradeoffs

- `$regex` search is flexible but slow on large collections without text indexes.
- `escapeRegex` is critical to prevent ReDoS attacks from user input.
- Date ranges always normalize to day boundaries (00:00:00 to 23:59:59.999).

### Related Patterns

- Index Patterns (database-patterns.md)
- Cache Header Patterns (section 8)

---

## 5. Error Response Patterns

**Purpose:** Standardized error handling via `AppError`, `asyncHandler`, and the global
error middleware.

**When to use:** Every error in every route handler.

### AppError Class

```ts
// server/src/middleware/errorHandler.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

### Error Handler Middleware

```ts
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details || {}),
    });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid ID format" });
  }
  if ((err as any).code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate entry" });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
}
```

### asyncHandler Wrapper

```ts
// server/src/middleware/asyncHandler.ts
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### Usage in Routes — Throwing AppError

```ts
// Using asyncHandler + throw
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id).lean();
  if (!item) throw new AppError(404, "Not found");
  res.json({ success: true, data: item });
}));
```

### Usage in Routes — Manual Status Codes

```ts
// Without asyncHandler — try/catch
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    // ... business logic
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
```

### Usage in Controllers — Response Helpers

```ts
// Using response helpers
export async function getById(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}
```

### Error Code Reference

| HTTP Status | When | Example |
|-------------|------|---------|
| 400 | Bad request / validation | "Username and password required" |
| 401 | No token / invalid token | "Unauthorized" / "Invalid token" |
| 403 | Role check fails | "Forbidden" / "Access denied" |
| 404 | Resource not found | "Customer not found" |
| 409 | Duplicate unique field | "Username already exists" / "Duplicate entry" |
| 500 | Unhandled / unexpected | "Internal Server Error" |

### Anti-Pattern

```ts
// WRONG — no asyncHandler, unhandled promise rejection crashes server
router.get("/", authenticate, async (req, res) => {
  const list = await Customer.find(); // if this throws, server crashes
  res.json({ success: true, data: list });
});

// WRONG — leaking internal error details
catch (err) {
  res.status(500).json({ success: false, message: err.stack });
}
```

### Tradeoffs

- `asyncHandler` is essential — without it, any thrown error in an async handler crashes
  the process.
- `AppError` vs inline `res.status(400).json(...)` — AppError is better for controller
  functions; inline is fine for small route handlers.
- The global error handler catches Mongoose-specific errors (`CastError`, `ValidationError`,
  duplicate key code 11000) so individual routes don't need to.

### Related Patterns

- Authentication Middleware (security-patterns.md)
- Validation Patterns (section 10)

---

## 6. Cache Header Patterns

**Purpose:** Redis-backed route-level caching with automatic invalidation and `x-cache`
headers for debugging.

**When to use:** GET endpoints that return stable data for a period.

### Cache Middleware

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

export async function invalidateCache(pattern: string): Promise<void> {
  await cacheDel(pattern);
  if (!pattern.includes("/dashboard")) {
    await cacheDel("*:/api/dashboard*");
  }
}
```

### TTL Configuration

```ts
// server/src/config.ts
export const CACHE_TTL = {
  DASHBOARD: 30,
  CUSTOMERS: 60,
  INVENTORY: 60,
  ORDERS: 30,
  BILLS: 30,
  DEFAULT: 60,
} as const;
```

### Usage in Routes

```ts
// Short TTL — data changes frequently
router.get("/", authenticate, cacheRoute(30), asyncHandler(async (req, res) => { ... }));

// Medium TTL — data changes less frequently
router.get("/", authenticate, cacheRoute(60), asyncHandler(customerController.getAll));

// No cache — mutations, auth, etc.
router.post("/", authenticate, audit, asyncHandler(async (req, res) => { ... }));
```

### Cache Invalidation on Mutations

```ts
// Single invalidation
await invalidateCache("/api/orders");

// Multiple invalidations
await Promise.all([
  invalidateCache("/api/payments"),
  invalidateCache("/api/bills"),
  invalidateCache("/api/dashboard"),
]);
```

### Branch-Scoped Cache Keys

Cache keys are prefixed with the branch ID so different branches have independent caches:

```
branchId123:/api/customers?limit=1000
branchId456:/api/customers?limit=1000
```

### Anti-Pattern

```ts
// WRONG — no cache invalidation after mutation
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body);
  // Missing: await invalidateCache("/api/inventory");
  res.json({ success: true, data: item });
}));

// WRONG — caching a POST endpoint
router.post("/", authenticate, cacheRoute(60), asyncHandler(async (req, res) => { ... }));
```

### Tradeoffs

- `x-cache: HIT` / `x-cache: MISS` headers help with debugging but add overhead.
- Cache invalidation uses SCAN with pattern matching — safe for large key sets but slower
  than direct key deletion.
- Dashboard cache is always invalidated alongside other resources because it aggregates
  all data.
- Redis failure is non-fatal — cacheGet/cacheSet silently return null/void.

### Related Patterns

- Redis Service (performance-patterns.md)
- Branch Scoping (section 7)

---

## 7. Branch Scoping Patterns

**Purpose:** Multi-tenant data isolation via the `x-branch-id` header. Each branch
gets its own MongoDB database and its own set of model instances.

**When to use:** Every request to branch-scoped resources.

### Branch Scope Middleware

```ts
// server/src/middleware/branch.ts
export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction) {
  const branchId = req.headers["x-branch-id"] as string || req.query._branch as string;

  if (branchId) {
    try {
      const branch = await Branch.findById(branchId).lean();
      if (branch && branch.isActive) {
        req.branchId = branch._id.toString();
        req.branchDb = branch.dbName;
        req.branchName = branch.name;
        const branchModels = getBranchModels(branch.dbName);
        req.branchModels = branchModels;

        const requestCtx: RequestContext = {
          branchId: req.branchId,
          branchName: req.branchName,
          branchModels,
        };

        ctx.run(requestCtx, () => next());
        return;
      }
    } catch (err) {
      console.error("Branch scope lookup failed:", err);
    }
  }
  next();
}
```

### Request Context (AsyncLocalStorage)

```ts
// server/src/utils/requestContext.ts
import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  branchModels?: BranchModels;
  branchId?: string;
  branchName?: string;
}

export const ctx = new AsyncLocalStorage<RequestContext>();

export function getCtx(): RequestContext | undefined {
  return ctx.getStore();
}
```

### Branch Proxy (Transparent Model Switching)

```ts
// server/src/utils/branchProxy.ts
export function withBranch<T extends Record<string, any>>(defaultModel: T, key: keyof BranchModels): T {
  return new Proxy(defaultModel, {
    get(_target, prop) {
      const ctx = getCtx();
      if (ctx?.branchModels) {
        const branchModel = ctx.branchModels[key];
        if (branchModel && typeof prop === "string") {
          const val = (branchModel as any)[prop];
          if (typeof val === "function") return val.bind(branchModel);
          return val;
        }
      }
      const val = (defaultModel as any)[prop];
      if (typeof val === "function") return val.bind(defaultModel);
      return val;
    },
    construct(_target, args) {
      const ctx = getCtx();
      if (ctx?.branchModels) {
        const branchModel = ctx.branchModels[key];
        if (branchModel) return new (branchModel as any)(...args);
      }
      return new (defaultModel as any)(...args);
    },
  });
}
```

### Model Registration with Proxy

```ts
// Every model is wrapped
const _Customer = model("Customer", CustomerSchemaObj);
export const Customer = withBranch(_Customer, "Customer");
```

### Route Mounting

```ts
// server/src/routes/index.ts
router.use("/customers", branchScope, customers);
router.use("/orders", branchScope, orders);
router.use("/bills", branchScope, bills);
// Auth and branches are NOT branch-scoped
router.use("/auth", auth);
router.use("/branches", branches);
```

### Client-Side Branch Header

```ts
// client/src/api.ts
function buildHeaders(isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const branchId = getBranchId();
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}
```

### Anti-Pattern

```ts
// WRONG — manually switching database in every route
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const branchId = req.headers["x-branch-id"];
  const conn = mongoose.connection.useDb(`branch_${branchId}`);
  const Customer = conn.model("Customer", CustomerSchema);
  const list = await Customer.find();
  res.json({ success: true, data: list });
}));
```

### Tradeoffs

- `AsyncLocalStorage` provides transparent branch switching without passing models through
  every function call — but can cause memory leaks if `ctx.run` is not properly cleaned up.
- The Proxy pattern means existing code (`Customer.find(...)`) works unchanged whether
  branch scoping is active or not.
- Fallback to default database (when no `x-branch-id` header) is by design — some routes
  like `/branches/active` work cross-branch.

### Related Patterns

- Database Branch Models (database-patterns.md)
- Cache Scoping (section 6)

---

## 8. Authentication Header Patterns

**Purpose:** JWT-based authentication via `Authorization: Bearer <token>` header.

**When to use:** Every protected endpoint.

### Authentication Middleware

```ts
// server/src/middleware/auth.ts
export interface JwtPayload {
  sub: string;
  username: string;
  role?: string;
  branchId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = header.split(" ")[1];
  try {
    const payload = verifyToken<JwtPayload>(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}
```

### Role Guard Middleware

```ts
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
```

### JWT Token Generation

```ts
// server/src/utils/jwt.ts
export function signAccess(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}

export function verifyToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
```

### Client-Side Token Handling

```ts
// client/src/api.ts — Auto-refresh on 401
async function request<T = unknown>(path: string, init: RequestOptions = {}): Promise<ApiResponse<T>> {
  let res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && !isLoginPath) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      const newHeaders = { ...init.headers, Authorization: `Bearer ${newToken}` };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      clearTokens();
      window.location.href = `/login?redirect=${returnUrl}`;
      return { success: false, message: "Session expired. Please login again." };
    }
  }
  // ...
}
```

### Anti-Pattern

```ts
// WRONG — no authentication on protected route
router.delete("/:id", asyncHandler(async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// WRONG — exposing token in URL
router.get("/data?token=abc123", ...);
```

### Tradeoffs

- Access tokens expire in 24h, refresh tokens in 7d — long-lived for an ERP used by
  a small team in a single shop.
- The `tryRefresh` function deduplicates concurrent refresh attempts via `refreshPromise`.
- `authenticate` middleware returns 401; `requireRole` returns 403 — important distinction.

### Related Patterns

- Security Patterns (security-patterns.md)
- JWT Patterns (security-patterns.md)

---

## 9. Rate Limiting Patterns

**Purpose:** Prevent abuse via global rate limiting using `express-rate-limit`.

**When to use:** Applied globally to all routes.

### Configuration

```ts
// server/src/app.ts
import rateLimit from "express-rate-limit";

app.use(
  rateLimit({
    windowMs: 60 * 1000,  // 1 minute window
    max: 200,             // 200 requests per minute per IP
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,  // Disable X-RateLimit-* headers
  })
);
```

### Response When Rate Limited

```json
{ "success": false, "message": "Too many requests, please try again later." }
```

### Anti-Pattern

```ts
// WRONG — no rate limiting at all
app.use("/api", routes);

// WRONG — too restrictive for a normal ERP
app.use(rateLimit({ windowMs: 60000, max: 10 })); // Only 10 requests per minute
```

### Tradeoffs

- 200 requests/minute is generous enough for normal ERP usage but prevents scripted abuse.
- `standardHeaders: true` adds `RateLimit-*` headers for monitoring.
- No per-route rate limits — the global limit is sufficient for a single-tenant ERP.

### Related Patterns

- Helmet Patterns (security-patterns.md)
- CORS Patterns (security-patterns.md)

---

## 10. Validation Patterns

**Purpose:** Request body validation using Zod schemas before processing.

**When to use:** POST, PUT, and PATCH endpoints that accept a request body.

### Zod Schema Definition

```ts
// server/src/routes/orders.ts
const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  lens: z.string().optional(),
  coating: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: z.string(),
  collectPayment: z.number().optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "नकद", "कार्ड", "बैंक", "बीमा", "Insurance"]).optional(),
  advanceQuantity: z.number().optional(),
});
```

### Usage in Route Handler

```ts
router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body); // Throws ZodError on invalid input
  const customer = await Customer.findById(p.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");
  const order = new Order(p as any);
  await order.save();
  invalidateCache("/api/orders");
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: order });
}));
```

### Manual Validation (Controller Pattern)

```ts
// server/src/controllers/authController.ts
export async function register(req: Request, res: Response) {
  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  // ...
}
```

### Field Allowlisting

```ts
// server/src/routes/inventory.ts — only allow specific fields
const allowed = ["brand", "model", "color", "size", "gender", "supplier",
  "quantity", "purchasePrice", "sellingPrice", "description", "category",
  "inventoryType", "location", "sku"];
const updates: Record<string, unknown> = {};
for (const key of allowed) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}
```

### Anti-Pattern

```ts
// WRONG — no validation, blindly passing req.body to database
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body); // Could contain arbitrary fields
  res.json({ success: true, data: item });
}));

// WRONG — validating after database operation
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body);
  // Too late — data already saved
  createSchema.parse(item);
  res.json({ success: true, data: item });
}));
```

### Tradeoffs

- Zod `.parse()` throws a `ZodError` that gets caught by the global error handler as a
  400 status — no need for manual error formatting.
- Allowlisting fields is safer than blacklist approaches — explicitly list what's allowed.
- Some routes (settings, branches) use allowlisting instead of Zod because the field list
  is dynamic.

### Related Patterns

- Error Response Patterns (section 5)
- Authentication Patterns (security-patterns.md)

---

## 11. Audit Logging Patterns

**Purpose:** Log who did what and when, for security and debugging.

**When to use:** Applied to all mutation endpoints (POST, PUT, DELETE, PATCH).

### Audit Middleware

```ts
// server/src/middleware/audit.ts
export function audit(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") return next();

  const authReq = req as AuthRequest;
  const entry = {
    time: Date.now(),
    method: req.method,
    path: req.originalUrl,
    user: authReq.user ? { id: authReq.user.sub, username: authReq.user.username } : null,
    ip: req.ip,
  };
  if (process.env.NODE_ENV !== "production") {
    console.log("AUDIT:", JSON.stringify(entry));
  }
  next();
}
```

### Usage in Routes

```ts
// Mutations get the audit middleware
router.post("/",   authenticate, audit, asyncHandler(...));
router.put("/:id", authenticate, audit, asyncHandler(...));
router.delete("/:id", authenticate, audit, asyncHandler(...));

// Reads do NOT get audit
router.get("/",    authenticate, cacheRoute(30), asyncHandler(...));
router.get("/:id", authenticate, asyncHandler(...));
```

### Anti-Pattern

```ts
// WRONG — audit on every endpoint (including reads) creates noise
router.get("/", authenticate, audit, asyncHandler(...));

// WRONG — no audit at all on mutations
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
}));
```

### Tradeoffs

- In production, audit logs are currently console.log only — for a future audit log
  collection system.
- In test mode, audit is skipped entirely to reduce test output noise.
- Audit records IP, user, method, path, and timestamp — enough for debugging but not
  for full compliance auditing.

### Related Patterns

- Security Patterns (security-patterns.md)
- Error Handling (section 5)
