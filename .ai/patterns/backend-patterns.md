# Backend Patterns — KMJ Optical ERP

> Reference guide for all Node.js/Express/TypeScript backend conventions.

---

## 1. Route Handler Patterns with Middleware Chains

**Purpose:** Compose middleware stacks per-route to handle auth, validation, caching,
audit logging, and branch scoping.

**When to use:** Every route definition.

### Standard GET Route

```ts
router.get("/", authenticate, cacheRoute(60), asyncHandler(customerController.getAll));
```

### Standard POST Route (with cache invalidation)

```ts
router.post("/", authenticate, asyncHandler(async (req, res, next) => {
  await invalidateCache("/api/customers");
  await invalidateCache("/api/dashboard");
  await customerController.create(req, res);
}));
```

### Standard PUT Route with Audit

```ts
router.put("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  await invalidateCache("/api/orders");
  await invalidateCache("/api/dashboard");
  await customerController.update(req, res);
}));
```

### Route with Complex Inline Business Logic

```ts
// server/src/routes/orders.ts — Status transition with side effects
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const wa = whatsappManager.getInstance((req as any).branchId);
    const { status, collectPayment, paymentMode, advanceQuantity } = statusUpdateSchema.parse(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    // ... complex business logic with multiple model updates
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
```

### Route Mounting with Middleware

```ts
// server/src/routes/index.ts
const router = Router();

// Branch-scoped routes
router.use("/customers", branchScope, customers);
router.use("/orders", branchScope, orders);
router.use("/bills", branchScope, bills);
router.use("/payments", branchScope, payments);
router.use("/inventory", branchScope, inventory);

// Global routes (not branch-scoped)
router.use("/auth", auth);
router.use("/branches", branches);
router.use("/cache", cacheAdmin);
```

### Anti-Pattern

```ts
// WRONG — middleware applied inconsistently
router.post("/", asyncHandler(async (req, res) => { ... })); // Missing authenticate
router.delete("/:id", cacheRoute(60), asyncHandler(...)); // Caching a DELETE

// WRONG — no asyncHandler
router.get("/", authenticate, async (req, res) => {
  const list = await Customer.find(); // Unhandled rejection if DB errors
  res.json({ success: true, data: list });
});
```

### Tradeoffs

- Some routes use `asyncHandler(controller)` (delegated to controller), others use
  inline `asyncHandler(async (req, res) => { ... })` — inline is used when the route
  has complex multi-model logic that doesn't fit neatly in a controller.
- `authenticate` is always first middleware after the route definition.
- `cacheRoute` is only on GET routes. `audit` is only on mutation routes.
- `invalidateCache` calls are always `await`ed to ensure cache is cleared before response.

### Related Patterns

- Authentication Middleware (security-patterns.md)
- Cache Middleware (api-patterns.md)

---

## 2. Model Schema Patterns with Indexes

**Purpose:** Mongoose schema definitions with proper typing, defaults, enums, and
indexes for query performance.

**When to use:** Every new Mongoose model.

### Customer Schema (Simple)

```ts
// server/src/models/customer.ts
const CustomerSchemaObj = new Schema(
  {
    customerId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    email: { type: String },
    age: { type: Number },
    gender: { type: String },
    mobile: { type: String, index: true },
    alternateMobile: { type: String },
    address: { type: String },
    city: { type: String },
    tags: { type: [String], default: [] },
    totalVisits: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Compound and single-field indexes
CustomerSchemaObj.index({ totalSpent: -1 });
CustomerSchemaObj.index({ createdAt: -1 });

export const CustomerSchema = CustomerSchemaObj;
const _Customer = model("Customer", CustomerSchemaObj);
export const Customer = withBranch(_Customer, "Customer");
```

### Order Schema (Complex with Enums)

```ts
// server/src/models/order.ts
const OrderSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    frame: { type: String },
    lens: { type: String },
    coating: { type: String },
    accessories: { type: [String], default: [] },
    quantity: { type: Number, default: 1 },
    forwardedCount: { type: Number, default: 0 },
    deliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
    status: {
      type: String,
      enum: ["Draft","Ordered","In Lab","Ready","Delivered","Cancelled"],
      default: "Draft"
    },
    classification: {
      type: String,
      enum: ["pending", "stock", "buy", "order"],
      default: "pending"
    },
    rightLensStatus: {
      type: String,
      enum: ["pending", "stock", "buy", "order"],
      default: "pending"
    },
    leftLensStatus: {
      type: String,
      enum: ["pending", "stock", "buy", "order"],
      default: "pending"
    },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound indexes for common queries
OrderSchemaObj.index({ customerId: 1, createdAt: -1 });
OrderSchemaObj.index({ status: 1, createdAt: -1 });
OrderSchemaObj.index({ classification: 1, createdAt: -1 });
OrderSchemaObj.index({ createdAt: -1 });
```

### Bill Schema (Nested Subdocuments)

```ts
// server/src/models/bill.ts
const BillItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
});

const BillSchemaObj = new Schema(
  {
    billNumber: { type: String, index: true, unique: true },
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    items: { type: [BillItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["Active","Cancelled"], default: "Active" }
  },
  { timestamps: true }
);

BillSchemaObj.index({ customerId: 1, createdAt: -1 });
BillSchemaObj.index({ pendingAmount: 1 });
BillSchemaObj.index({ createdAt: -1 });
```

### Prescription Schema (Deeply Nested)

```ts
// server/src/models/prescription.ts
const EyeSchema = new Schema({
  sph: { type: Number },
  cyl: { type: Number },
  axis: { type: Number },
  va: { type: String }
});

const PrescriptionSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    rightEye: { dv: EyeSchema, nv: EyeSchema, pc: EyeSchema },
    leftEye: { dv: EyeSchema, nv: EyeSchema, pc: EyeSchema },
    pd: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

PrescriptionSchemaObj.index({ customerId: 1, createdAt: -1 });
PrescriptionSchemaObj.index({ visitId: 1 });
```

### Anti-Pattern

```ts
// WRONG — no indexes, every query is a full collection scan
const OrderSchema = new Schema({ customerId: ObjectId, status: String });

// WRONG — no timestamps, can't sort by creation date
const CustomerSchema = new Schema({ name: String }, { timestamps: false });

// WRONG — no defaults, undefined values propagate
const OrderSchema = new Schema({ quantity: { type: Number } }); // No default: 1
```

### Tradeoffs

- `timestamps: true` is used on every schema — creates `createdAt` and `updatedAt` fields
  automatically.
- `{ lean: true }` is used in most queries to skip Mongoose document hydration.
- Compound indexes like `{ customerId: 1, createdAt: -1 }` support the most common query
  pattern: "all records for this customer, newest first."
- Denormalized fields (`totalVisits`, `totalSpent`, `pendingAmount`) on Customer avoid
  expensive aggregation queries on every page load.

### Related Patterns

- Index Patterns (database-patterns.md)
- Denormalization Patterns (database-patterns.md)

---

## 3. Controller Patterns with Business Logic

**Purpose:** Extract business logic from route handlers into controller functions for
reusability and testability.

**When to use:** Resources with CRUD operations that follow a consistent pattern.

### Customer Controller — Full CRUD

```ts
// server/src/controllers/customerController.ts
import { success, created, notFound } from "../utils/response";

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
  return success(res, { data, total, page: parseInt(page as string), pages: Math.ceil(total / parseInt(limit as string)) });
}

export async function getById(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}

export async function create(req: Request, res: Response) {
  const { name, mobile } = req.body;
  if (!name?.trim()) throw new AppError(400, "Name is required");
  if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
  const customer = await Customer.create({ ...req.body, mobile: mobile.trim() });
  return created(res, customer);
}

export async function update(req: Request, res: Response) {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}

export async function remove(req: Request, res: Response) {
  const customer = await Customer.findByIdAndDelete(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  // Cascade delete related records
  const customerId = req.params.id;
  await Promise.all([
    Visit.deleteMany({ customerId }),
    Order.deleteMany({ customerId }),
    Bill.deleteMany({ customerId }),
    Prescription.deleteMany({ customerId }),
    Payment.deleteMany({ customerId }),
    Delivery.deleteMany({ customerId }),
  ]);
  return success(res, customer);
}
```

### Customer Summary — Aggregation

```ts
export async function getSummary(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  const [visitCount, orderCount, billTotal] = await Promise.all([
    Visit.countDocuments({ customerId: req.params.id }),
    Order.countDocuments({ customerId: req.params.id }),
    Bill.aggregate([
      { $match: { customerId: req.params.id } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  return success(res, {
    ...customer,
    visitCount,
    orderCount,
    totalBilled: billTotal[0]?.total || 0,
  });
}
```

### Todo Controller — Minimal

```ts
// server/src/controllers/todoController.ts
export async function getAll(_req: Request, res: Response) {
  const todos = await Todo.find().sort({ createdAt: -1 }).lean();
  return success(res, todos);
}

export async function create(req: Request, res: Response) {
  const { task, notes } = req.body;
  if (!task?.trim()) throw new AppError(400, "Task is required");
  const todo = await Todo.create({ task: task.trim(), notes });
  return created(res, todo);
}
```

### Anti-Pattern

```ts
// WRONG — business logic mixed into route handlers
router.post("/", authenticate, asyncHandler(async (req, res) => {
  // 50 lines of validation, database operations, cache invalidation, etc.
}));

// WRONG — controller returns raw Express response without helpers
export async function create(req: Request, res: Response) {
  const customer = await Customer.create(req.body);
  res.status(201).json({ success: true, data: customer }); // Should use created()
}
```

### Tradeoffs

- Some routes have inline handlers (orders, dashboard) because the logic spans multiple
  models and doesn't fit a simple controller pattern.
- Controllers use `response.ts` helpers (`success`, `created`, `notFound`) for consistency.
- `AppError` thrown in controllers is caught by the global error handler.

### Related Patterns

- Error Handling (section 5)
- Response Formatting (section 7)

---

## 4. Service Patterns with External Integrations

**Purpose:** Encapsulate external service interactions (WhatsApp, Redis cache) behind
clean interfaces.

**When to use:** Any integration with external APIs or infrastructure.

### Cache Service

```ts
// server/src/services/cache.ts
import Redis from "ioredis";

export const CACHE_PREFIX = "route:";
const DEFAULT_TTL = 60;
let client: Redis | null = null;
let connected = false;

export function initCache(redisUrl: string): Redis {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  client.on("connect", () => { connected = true; });
  client.on("close", () => { connected = false; });
  client.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) return;
    if (process.env.NODE_ENV !== "production") console.warn("Redis:", err.message);
  });

  return client;
}

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

### WhatsApp Service (Singleton per Branch)

```ts
// server/src/services/whatsapp.ts (simplified)
class WhatsAppManager {
  private instances = new Map<string, WhatsAppInstance>();

  getInstance(branchId?: string): WhatsAppInstance {
    const key = branchId || "default";
    if (!this.instances.has(key)) {
      this.instances.set(key, new WhatsAppInstance(key));
    }
    return this.instances.get(key)!;
  }
}

export const whatsappManager = new WhatsAppManager();
```

### Anti-Pattern

```ts
// WRONG — Redis client created per request
router.get("/", asyncHandler(async (req, res) => {
  const redis = new Redis(process.env.REDIS_URL); // New connection every request!
  const cached = await redis.get("key");
  // ...
}));

// WRONG — no error handling on external service
const result = await wa.sendMessage(phone, msg); // If WhatsApp is down, unhandled rejection
```

### Tradeoffs

- Cache service is designed to be non-fatal — Redis failures don't crash the app.
- `lazyConnect: true` means Redis connects on first operation, not at startup.
- WhatsApp service uses singleton pattern so each branch has one persistent connection.
- `cacheDel` uses SCAN for pattern-based deletion — safe for large key sets.

### Related Patterns

- Cache Middleware (api-patterns.md)
- Branch Proxy (database-patterns.md)

---

## 5. Error Handling Patterns

**Purpose:** Centralized error handling via `AppError`, `asyncHandler`, and global
error middleware.

**When to use:** Every error in every route handler.

### AppError — Custom Application Error

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

### asyncHandler — Promise Rejection Catcher

```ts
// server/src/middleware/asyncHandler.ts
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### Global Error Handler

```ts
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Custom application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false, message: err.message, ...(err.details || {}),
    });
  }
  // Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  // Invalid ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid ID format" });
  }
  // Duplicate key
  if ((err as any).code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate entry" });
  }
  // Unknown error
  console.error("Unhandled error:", err);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
}
```

### App.ts Error Handler Mounting

```ts
// server/src/app.ts
app.use(errorHandler); // Must be LAST middleware
```

### Usage Patterns

```ts
// Pattern 1: throw AppError in asyncHandler
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id).lean();
  if (!item) throw new AppError(404, "Not found");
  res.json({ success: true, data: item });
}));

// Pattern 2: Manual try/catch for complex routes
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    // ... complex logic
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Pattern 3: Return error via response helper in controller
export async function getById(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}
```

### Anti-Pattern

```ts
// WRONG — unhandled promise rejection crashes server
router.get("/", authenticate, async (req, res) => {
  const list = await Customer.find(); // If DB connection drops, server crashes
  res.json({ success: true, data: list });
});

// WRONG — leaking stack traces to client
catch (err) {
  res.status(500).json({ success: false, message: err.stack });
}

// WRONG — swallowing errors
catch (err) {
  console.log(err); // Silent failure, user sees nothing
}
```

### Tradeoffs

- Three error handling patterns coexist — `asyncHandler`, manual `try/catch`, and
  controller helpers. Each is appropriate for different complexity levels.
- `CastError` handling catches invalid MongoDB ObjectId format — common when users
  construct bad URLs.
- Duplicate key (code 11000) returns 409 Conflict — appropriate for unique constraint
  violations.
- Production logging is minimal to avoid log noise — only unhandled errors are logged.

### Related Patterns

- Validation Patterns (api-patterns.md)
- Authentication Errors (security-patterns.md)

---

## 6. Validation Patterns (Zod + Manual)

**Purpose:** Validate request bodies before processing, using either Zod schemas or
manual validation.

**When to use:** Every POST, PUT, and PATCH endpoint.

### Zod Schema Pattern

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

// Usage
router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body); // Throws ZodError → caught as 400
  // p is now typed and validated
}));
```

### Manual Validation Pattern

```ts
// server/src/controllers/authController.ts
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  // ...
}
```

### Field Allowlisting Pattern

```ts
// server/src/routes/inventory.ts
const allowed = ["brand", "model", "color", "size", "gender", "supplier",
  "quantity", "purchasePrice", "sellingPrice", "description", "category",
  "inventoryType", "location", "sku"];
const updates: Record<string, unknown> = {};
for (const key of allowed) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}
const it = await Inventory.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
```

### Settings Allowlisting

```ts
// server/src/routes/settings.ts
const allowedSettings = [
  "shopName", "shopPhone", "shopAddress", "gstin", "email", "invoicePrefix",
  "defaultDiscount", "taxRate", "currency", "timezone", "whatsappNumber",
  "orderMessage", "deliveryMessage", "receiptFooter", "theme"
];

const updates: Record<string, unknown> = {};
for (const key of allowedSettings) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}
```

### Anti-Pattern

```ts
// WRONG — passing req.body directly to database
const customer = await Customer.create(req.body); // Could include _id injection, __v override

// WRONG — no validation at all
router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.findByIdAndUpdate(req.params.id, req.body);
  // User could set arbitrary fields
}));
```

### Tradeoffs

- Zod is used for complex schemas (orders, payments) where type inference is valuable.
- Manual validation is used for simple forms (auth, customers) where the check is just
  `if (!field)`.
- Allowlisting is used for settings-like endpoints where the set of valid fields is known
  but dynamic.
- Zod `.parse()` throws `ZodError` which gets caught by the global error handler as
  a 400 status with a descriptive message.

### Related Patterns

- Error Handling (section 5)
- Input Sanitization (security-patterns.md)

---

## 7. Response Formatting Patterns

**Purpose:** Consistent response shapes across all endpoints using helper functions.

**When to use:** Every response sent to the client.

### Response Helper Functions

```ts
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

### Inline Response Pattern (Most Routes)

```ts
// Most routes use inline json() calls
res.json({ success: true, data: enriched });
res.json({ success: true, data: order });
res.json({ success: true, message: "Deleted" });
res.status(404).json({ success: false, message: "Not found" });
res.status(400).json({ success: false, message: err.message });
```

### Controller Response Pattern

```ts
// Controllers use helper functions
return success(res, customer);
return created(res, customer);
return notFound(res, "Customer not found");
return success(res, { data, total, page, pages });
```

### Complex Response with Metadata

```ts
// Dashboard — large response with many fields
res.json({
  success: true,
  data: {
    counts: { customers, orders, bills, payments, inventory, deliveries, visits },
    todaySales: todaySales[0]?.total || 0,
    todayCollection: todayCollection[0]?.total || 0,
    // ... 20+ more fields
  },
});
```

### Anti-Pattern

```ts
// WRONG — inconsistent response shapes
res.json({ ok: true, result: data });
res.json({ status: "success", payload: data });
res.send(data);
res.json({ success: true, items: data }); // Different key names
```

### Tradeoffs

- Two styles coexist: inline `res.json` in route handlers and helper functions in
  controllers. This is acceptable because both produce the same `{ success, data }` shape.
- The `created` helper defaults to 201 — important for REST semantics.
- `fail` accepts an `extra` parameter for adding additional metadata to error responses.

### Related Patterns

- API Response Format (api-patterns.md)
- Error Handling (section 5)

---

## 8. Cache Invalidation Patterns

**Purpose:** Invalidate Redis cache entries when data changes to ensure consistency.

**When to use:** After every POST, PUT, PATCH, or DELETE operation.

### Single Resource Invalidation

```ts
// After customer mutation
await invalidateCache("/api/customers");
```

### Multiple Resource Invalidation

```ts
// After bill creation (affects bills, dashboard)
await Promise.all([
  invalidateCache("/api/bills"),
  invalidateCache("/api/dashboard"),
]);
```

### Cascading Invalidation

```ts
// After payment (affects payments, bills, dashboard)
await Promise.all([
  invalidateCache("/api/payments"),
  invalidateCache("/api/bills"),
  invalidateCache("/api/dashboard"),
]);
```

### Dashboard Always Invalidated

```ts
// invalidateCache automatically includes dashboard
export async function invalidateCache(pattern: string): Promise<void> {
  await cacheDel(pattern);
  if (!pattern.includes("/dashboard")) {
    await cacheDel("*:/api/dashboard*");
  }
}
```

### Branch-Scoped Invalidation

```ts
// Cache keys are prefixed with branch ID
// "branch123:/api/customers?limit=1000"
// cacheDel uses SCAN to find all branch variants
const branchPattern = pattern.startsWith("*:") ? pattern : `*:${pattern}`;
const keys = await scanKeys(branchPattern);
```

### Cache Invalidation in Route Handlers

```ts
// Pattern 1: Before the operation
router.post("/", authenticate, asyncHandler(async (req, res, next) => {
  await invalidateCache("/api/customers");
  await customerController.create(req, res);
}));

// Pattern 2: After the operation (inline routes)
router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body);
  const order = new Order(p as any);
  await order.save();
  invalidateCache("/api/orders"); // Fire-and-forget
  invalidateCache("/api/dashboard");
  res.json({ success: true, data: order });
}));
```

### Anti-Pattern

```ts
// WRONG — no cache invalidation after mutation
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body);
  res.json({ success: true, data: item }); // Cache is now stale
}));

// WRONG — invalidating wrong resource
router.post("/orders", authenticate, asyncHandler(async (req, res) => {
  await invalidateCache("/api/customers"); // Wrong resource
}));
```

### Tradeoffs

- `invalidateCache` uses `await` in most routes to ensure cache is cleared before response.
- Some inline routes use fire-and-forget (no `await`) for performance — acceptable because
  the next request will see stale data briefly.
- Dashboard is always invalidated because it aggregates all data — any change affects it.
- `cacheDel` uses SCAN pattern matching — safe but slower than direct key deletion.

### Related Patterns

- Cache Middleware (api-patterns.md)
- Redis Service (performance-patterns.md)

---

## 9. Branch Scope Patterns

**Purpose:** Multi-tenant data isolation via MongoDB database switching per branch.

**When to use:** Every request to branch-scoped resources.

### Branch Database Model Cache

```ts
// server/src/models/db.ts
const branchModelCache = new Map<string, BranchModels>();

export function getBranchModels(dbName: string): BranchModels {
  if (!branchModelCache.has(dbName)) {
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    const models = registerModels(conn);
    branchModelCache.set(dbName, models);
  }
  return branchModelCache.get(dbName)!;
}

function registerModels(conn: mongoose.Connection): BranchModels {
  const s = loadSchemas();
  function getModel<T>(name: string, schema: Schema): Model<T> {
    if (conn.models[name]) return conn.models[name] as Model<T>;
    return conn.model<T>(name, schema);
  }
  return {
    Customer: getModel("Customer", s.Customer),
    Visit: getModel("Visit", s.Visit),
    Order: getModel("Order", s.Order),
    Bill: getModel("Bill", s.Bill),
    Payment: getModel("Payment", s.Payment),
    Inventory: getModel("Inventory", s.Inventory),
    Delivery: getModel("Delivery", s.Delivery),
    Settings: getModel("Settings", s.Settings),
    Todo: getModel("Todo", s.Todo),
    Prescription: getModel("Prescription", s.Prescription),
  };
}
```

### Branch Proxy Pattern

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
      // Fallback to default model
      const val = (defaultModel as any)[prop];
      if (typeof val === "function") return val.bind(defaultModel);
      return val;
    },
  });
}
```

### Model Registration

```ts
// Every model is wrapped with withBranch
const _Customer = model("Customer", CustomerSchemaObj);
export const Customer = withBranch(_Customer, "Customer");

const _Order = model("Order", OrderSchemaObj);
export const Order = withBranch(_Order, "Order");
```

### Request Flow

```
1. Client sends header: x-branch-id: branch123
2. branchScope middleware looks up branch → gets dbName
3. getBranchModels(dbName) → creates/retrieves branch-specific models
4. ctx.run({ branchModels }, next) → stores in AsyncLocalStorage
5. Route handler calls Customer.find() → Proxy intercepts → uses branch model
6. Branch model queries the branch-specific database
```

### Non-Branch-Scoped Routes

```ts
// These routes work across all branches
router.use("/auth", auth);           // User auth is global
router.use("/branches", branches);   // Branch management is global
router.use("/cache", cacheAdmin);    // Cache admin is global
```

### Anti-Pattern

```ts
// WRONG — manually switching database in every route
router.get("/", asyncHandler(async (req, res) => {
  const branchId = req.headers["x-branch-id"];
  const conn = mongoose.connection.useDb(`branch_${branchId}`);
  const Model = conn.model("Customer", CustomerSchema);
  const list = await Model.find();
  res.json({ success: true, data: list });
}));

// WRONG — no fallback for missing branch
if (!ctx?.branchModels) throw new Error("No branch"); // Breaks non-branch routes
```

### Tradeoffs

- `useDb(dbName, { noListener: true })` avoids connection event listener leaks.
- `branchModelCache` prevents recreating models for the same branch on every request.
- The Proxy pattern means existing code (`Customer.find(...)`) works unchanged — no
  need to refactor when adding branch scoping.
- `AsyncLocalStorage` is the most elegant solution but has subtle debugging challenges.

### Related Patterns

- Branch Middleware (api-patterns.md)
- Request Context (database-patterns.md)

---

## 10. Audit Logging Patterns

**Purpose:** Track who performed what action and when, for security and debugging.

**When to use:** Applied to all mutation endpoints.

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

### Usage

```ts
// Mutations get audit
router.post("/", authenticate, audit, asyncHandler(...));
router.put("/:id", authenticate, audit, asyncHandler(...));
router.delete("/:id", authenticate, audit, asyncHandler(...));

// Reads do NOT get audit
router.get("/", authenticate, cacheRoute(30), asyncHandler(...));
```

### Audit Entry Format

```json
{
  "time": 1721098765432,
  "method": "POST",
  "path": "/api/orders",
  "user": { "id": "507f1f77bcf86cd799439011", "username": "admin" },
  "ip": "192.168.1.100"
}
```

### Anti-Pattern

```ts
// WRONG — audit on read endpoints (too noisy)
router.get("/", authenticate, audit, cacheRoute(30), asyncHandler(...));

// WRONG — no audit on delete
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
}));
```

### Tradeoffs

- Current implementation is console.log only — structured logging (e.g., to a collection)
  is a future enhancement.
- In test mode, audit is skipped to reduce test output.
- Audit records IP address for security forensics.
- `req.originalUrl` captures the full path including query parameters.

### Related Patterns

- Security Patterns (security-patterns.md)
- Authentication Middleware (security-patterns.md)
