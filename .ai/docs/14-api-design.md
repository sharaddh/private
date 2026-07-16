# 14 - API Design

## Purpose

This document defines REST API design principles for the KMJ Optical ERP backend. It covers endpoint naming, HTTP methods, status codes, pagination, filtering, sorting, search, request/response formats, error responses, versioning, rate limiting, and CORS.

## API Structure

### Base URL

```
Production: https://kmjoptical.onrender.com/api
Development: http://localhost:4000/api
```

### Route Registration

```typescript
// server/src/routes/index.ts
const router = Router();

router.use("/branches", branches);           // Root DB - no branchScope
router.use("/auth", auth);                   // Root DB - no branchScope
router.use("/customers", branchScope, customers);  // Branch-scoped
router.use("/orders", branchScope, orders);        // Branch-scoped
router.use("/bills", branchScope, bills);          // Branch-scoped
router.use("/payments", branchScope, payments);    // Branch-scoped
router.use("/inventory", branchScope, inventory);  // Branch-scoped
router.use("/dashboard", branchScope, dashboard);  // Branch-scoped
router.use("/reports", branchScope, reports);      // Branch-scoped
router.use("/workspace", branchScope, workspace);  // Branch-scoped
router.use("/whatsapp", branchScope, whatsapp);    // Branch-scoped
router.use("/cache", cacheAdmin);             // System - no branchScope
router.use("/recalculate", recalculate);      // System - no branchScope
```

### Route Naming Conventions

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/:id` | Get single customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |
| GET | `/api/customers/summary/:id` | Get customer summary |
| PATCH | `/api/orders/:id/status` | Update order status |
| PATCH | `/api/orders/:id/classify` | Set classification |

### Naming Rules

1. **Plural nouns** for resource collections (`/customers`, not `/customer`)
2. **camelCase** for query parameters (`startDate`, `customerId`)
3. **kebab-case** for multi-word paths (`/warehouse-login`, not `/warehouseLogin`)
4. **No verbs in paths** - use HTTP methods instead
5. **Nested resources** for related data (`/customers/:id/visits`)
6. **Action routes** use verb only when necessary (`/demand-send`, `/broadcast`)

## HTTP Methods

### Method Usage

| Method | Purpose | Body | Idempotent |
|--------|---------|------|------------|
| GET | Read resources | No | Yes |
| POST | Create resources or trigger actions | Yes | No |
| PUT | Full update of resource | Yes | Yes |
| PATCH | Partial update of resource | Yes | Yes |
| DELETE | Remove resource | No | Yes |

### Method Examples

```typescript
// GET - Read
router.get("/", authenticate, cacheRoute(60), asyncHandler(handler));
router.get("/:id", authenticate, asyncHandler(handler));

// POST - Create
router.post("/", authenticate, audit, asyncHandler(handler));

// PUT - Full update
router.put("/:id", authenticate, audit, asyncHandler(handler));

// PATCH - Partial update
router.patch("/:id/status", authenticate, asyncHandler(handler));
router.patch("/:id/classify", authenticate, asyncHandler(handler));

// DELETE - Remove
router.delete("/:id", authenticate, audit, asyncHandler(handler));
```

## Status Codes

### Success Codes

| Code | Usage | Example |
|------|-------|---------|
| 200 | Successful GET, PUT, PATCH, DELETE | Most responses |
| 201 | Successful POST (creation) | `created(res, data)` |
| 204 | Successful DELETE with no body | Rarely used |

### Error Codes

| Code | Usage | Example |
|------|-------|---------|
| 400 | Bad request / validation error | Missing required fields |
| 401 | Unauthorized / invalid token | Missing or invalid JWT |
| 403 | Forbidden / insufficient permissions | Staff accessing owner endpoints |
| 404 | Resource not found | Invalid ID |
| 409 | Conflict / duplicate entry | Duplicate username |
| 422 | Unprocessable entity | Invalid status transition |
| 429 | Rate limit exceeded | Too many requests |
| 500 | Internal server error | Unhandled exceptions |

### Status Code Rules

1. **Always use 400** for validation errors
2. **Always use 401** for authentication failures
3. **Always use 403** for authorization failures
4. **Always use 404** for missing resources
5. **Always use 409** for duplicate key violations
6. **Always use 500** for unhandled errors
7. **Never expose internal details** in error responses

## Response Format

### Success Response

```typescript
{
  "success": true,
  "data": { ... }
}
```

### Created Response

```typescript
{
  "success": true,
  "data": { ... },
  "message": "Created successfully"
}
```

### Paginated Response

```typescript
{
  "success": true,
  "data": {
    "data": [ ... ],
    "total": 150,
    "page": 1,
    "pages": 8
  }
}
```

### Error Response

```typescript
{
  "success": false,
  "message": "Customer not found"
}
```

### Validation Error Response

```typescript
{
  "success": false,
  "message": [
    { "code": "invalid_type", "expected": "string", "received": "undefined", "path": ["name"], "message": "Required" }
  ]
}
```

### Response Helpers

```typescript
// server/src/utils/response.ts
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

### Response Rules

1. **Always use `{ success, data/message }` format**
2. **Always set appropriate HTTP status codes**
3. **Never expose stack traces** or internal details
4. **Always use consistent field naming** (camelCase)
5. **Always include `success: false`** on errors

## Request Format

### JSON Body

```typescript
// Content-Type: application/json
{
  "name": "Rahul Kumar",
  "mobile": "9876543210",
  "email": "rahul@example.com"
}
```

### Query Parameters

```
GET /api/customers?page=1&limit=20&search=rahul&sort=-createdAt
GET /api/orders?status=Ordered&startDate=2024-01-01&endDate=2024-12-31
GET /api/bills?customerId=123&startDate=2024-01-01
```

### Custom Headers

| Header | Purpose | Example |
|--------|---------|---------|
| `Authorization` | JWT token | `Bearer eyJhbG...` |
| `x-branch-id` | Branch scope | `64f1a2b3c4d5e6f7a8b9c0d1` |
| `Content-Type` | Request body format | `application/json` |

## Branch Scoping

### How It Works

1. Client sends `x-branch-id` header on all requests
2. `branchScope` middleware validates branch exists and is active
3. All subsequent database operations route to branch database
4. Proxy system transparently routes model operations

### Client Implementation

```typescript
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

### Branch-less Routes

Some routes don't need branch scoping:
- `/api/auth` - Authentication (root DB)
- `/api/branches` - Branch management (root DB)
- `/api/cache` - Cache admin (system)

## Pagination

### Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 1000 | Items per page |

### Implementation

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

### Pagination Rules

1. **Default to 1000** for list endpoints (most lists are small)
2. **Always return `total`** count for client pagination
3. **Always return `page` and `pages`** for navigation
4. **Always sort by `createdAt: -1`** by default (newest first)
5. **Use cursor-based pagination** for large datasets (future improvement)

## Filtering

### Query Parameter Filters

```typescript
// customers?phone=9876543210
if (phone) filter.mobile = { $regex: phone as string, $options: "i" };

// orders?status=Ordered
if (status) filter.status = status;

// orders?customerId=123
if (customerId) filter.customerId = customerId;

// bills?startDate=2024-01-01&endDate=2024-12-31
if (startDate || endDate) {
  filter.createdAt = {};
  if (startDate) {
    const s = new Date(startDate as string);
    s.setHours(0, 0, 0, 0);
    filter.createdAt.$gte = s;
  }
  if (endDate) {
    const e = new Date(endDate as string);
    e.setHours(23, 59, 59, 999);
    filter.createdAt.$lte = e;
  }
}
```

### Filter Rules

1. **Use query parameters** for filtering (not request body)
2. **Use `$regex` with `$options: "i"`** for text search
3. **Always escape regex** special characters
4. **Always handle date ranges** with proper start/end of day
5. **Always validate filter values** before using in queries

## Sorting

### Sort Parameters

```
GET /api/customers?sort=-createdAt        (newest first)
GET /api/customers?sort=totalSpent        (highest spend first)
GET /api/customers?sort=-totalSpent       (lowest spend first)
```

### Implementation

```typescript
// Default sort
const sort = { createdAt: -1 };

// Custom sort
const sortField = req.query.sort as string;
if (sortField) {
  const direction = sortField.startsWith("-") ? -1 : 1;
  const field = sortField.replace(/^-/, "");
  sort[field] = direction;
}
```

## Search

### Text Search

```typescript
// customers?search=rahul
if (search) {
  const s = search as string;
  filter.$or = [
    { name: { $regex: s, $options: "i" } },
    { mobile: { $regex: s, $options: "i" } },
  ];
}
```

### Multi-field Search

```typescript
// inventory?q=rayban
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
```

## Middleware Chain

### Standard Chain Order

```
authenticate → branchScope → cacheRoute → validation → handler
```

### Middleware Examples

```typescript
// Read (with caching)
router.get("/", authenticate, branchScope, cacheRoute(60), asyncHandler(handler));

// Create (with audit)
router.post("/", authenticate, branchScope, audit, asyncHandler(handler));

// Update (with audit)
router.put("/:id", authenticate, branchScope, audit, asyncHandler(handler));

// Delete (with audit)
router.delete("/:id", authenticate, branchScope, audit, asyncHandler(handler));

// Action (no caching)
router.patch("/:id/status", authenticate, branchScope, asyncHandler(handler));
```

### Middleware Rules

1. **`authenticate`** always comes first (after route matching)
2. **`branchScope`** comes second for branch-scoped routes
3. **`cacheRoute`** only on GET requests
4. **`audit`** on mutating operations (POST, PUT, DELETE)
5. **`requireRole`** when role-based access is needed
6. **`asyncHandler`** always wraps the final handler

## Versioning

### Current Version

The API currently has no explicit versioning. All endpoints are at `/api/`.

### Future Versioning Strategy

If versioning is needed:
```
/api/v1/customers
/api/v2/customers
```

### Versioning Rules

1. **Use URL path versioning** (not header-based)
2. **Never break existing endpoints** - add new versions instead
3. **Maintain old versions** until all clients migrate
4. **Document breaking changes** in changelog

## Rate Limiting

### Configuration

```typescript
// server/src/app.ts
app.use(
  rateLimit({
    windowMs: 60 * 1000,    // 1 minute window
    max: 200,                // 200 requests per window
    standardHeaders: true,   // Return rate limit info in headers
    legacyHeaders: false,    // Disable X-RateLimit-* headers
  })
);
```

### Rate Limit Headers

```
RateLimit-Limit: 200
RateLimit-Remaining: 195
RateLimit-Reset: 1705312800
```

### Rate Limit Rules

1. **Global rate limit** on all `/api` routes
2. **200 requests per minute** per IP
3. **Return 429** when exceeded
4. **Use standard headers** for client awareness
5. **Consider stricter limits** for auth endpoints (future)

## CORS

### Configuration

```typescript
app.use(cors({
  origin: [
    "https://kmjoptical.onrender.com",  // Production
    "http://localhost:5173",             // Dev client
    "http://localhost:4000",             // Dev server
    "http://localhost:5174",             // Dev warehouse
  ],
  credentials: true,
}));
```

### CORS Rules

1. **Whitelist specific origins** (never use `*` in production)
2. **Enable credentials** for JWT cookies
3. **Allow custom headers** (`x-branch-id`)
4. **Allow standard methods** (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)
5. **Test CORS** with preflight requests

## Bad Examples

```typescript
// BAD: Verb in path
router.get("/api/getCustomers", handler);
router.post("/api/createCustomer", handler);

// BAD: Singular resource
router.get("/api/customer", handler);

// BAD: Exposing internal errors
res.status(500).json({ error: err.stack });

// BAD: Inconsistent response format
res.json({ result: "ok", customers: [] });
res.json({ error: false, data: [] });

// BAD: No branch scoping
router.get("/", authenticate, handler); // Missing branchScope

// BAD: Caching POST requests
router.post("/", authenticate, cacheRoute(60), handler);

// BAD: Skipping authentication
router.get("/public-data", handler); // No authenticate middleware
```

## Good Examples

```typescript
// GOOD: RESTful naming
router.get("/", authenticate, cacheRoute(60), asyncHandler(handler));
router.post("/", authenticate, audit, asyncHandler(handler));
router.get("/:id", authenticate, asyncHandler(handler));
router.put("/:id", authenticate, audit, asyncHandler(handler));
router.delete("/:id", authenticate, audit, asyncHandler(handler));

// GOOD: Consistent response format
res.json({ success: true, data: customers });
res.json({ success: false, message: "Customer not found" });

// GOOD: Proper status codes
return res.status(404).json({ success: false, message: "Not found" });
return res.status(400).json({ success: false, message: "Invalid input" });

// GOOD: Branch-scoped route
router.get("/", authenticate, branchScope, cacheRoute(60), asyncHandler(handler));

// GOOD: Paginated response
return success(res, { data, total, page, pages });
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| No API versioning | Simpler codebase | Breaking changes harder to manage |
| Branch via header | Flexible, works with any client | Must remember to send header |
| Regex search | Flexible text matching | ReDoS risk, slower than text index |
| Large default limit (1000) | Fewer round trips | More data per response |
| Cache all GET routes | Faster reads | Cache invalidation complexity |
| Global rate limit | Simple protection | No per-user differentiation |

## Cross-References

- **Express patterns**: See `docs/11-express.md`
- **Authentication**: See `docs/15-authentication.md`
- **Authorization**: See `docs/16-authorization.md`
- **Caching**: See `docs/24-caching.md`
- **Error handling**: See `docs/19-error-handling.md`
- **Security**: See `docs/22-security.md`

## AI Instructions

When working on API endpoints:
1. Always follow RESTful naming conventions
2. Always use appropriate HTTP methods
3. Always return consistent response format
4. Always set proper HTTP status codes
5. Always validate inputs before processing
6. Always apply authenticate middleware
7. Always apply branchScope for branch data
8. Always use asyncHandler for async handlers
9. Always cache GET responses when appropriate
10. Always run linting after changes
