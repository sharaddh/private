# 13 - MongoDB Patterns

## Purpose

This document defines MongoDB-specific patterns for the KMJ Optical ERP, including schema design, Mongoose ODM usage, the branch proxy system, AsyncLocalStorage context, aggregation pipelines, indexing strategies, and connection management. Every database-related change must follow these conventions.

## Architecture Overview

### Database-Per-Branch Strategy

The KMJ ERP uses a database-per-branch multi-tenant architecture:

```
Root Database (kmj)
  ├── users          (User model - global)
  └── branches       (Branch model - global)

Branch Database (kmj_govindpuri)
  ├── customers
  ├── visits
  ├── prescriptions
  ├── orders
  ├── bills
  ├── payments
  ├── inventory
  ├── deliveries
  ├── settings
  └── todos
```

Each branch gets its own MongoDB database (e.g., `kmj_govindpuri`, `kmj_falke_bajar`). All business data is scoped to the branch database. Only users and branches live in the root database.

### Why Database-Per-Branch?

1. **Data Isolation**: Branch data cannot leak between branches
2. **Security**: No accidental cross-branch queries
3. **Scalability**: Each branch database can be sized independently
4. **Backup/Restore**: Individual branches can be backed up or restored without affecting others
5. **Compliance**: Data residency requirements can be met per branch

## Connection Management

### Mongoose Connection

```typescript
// server/src/index.ts
import mongoose, { connect, disconnect } from "mongoose";

await connect(MONGO_URI, {
  maxPoolSize: 10,                   // Connection pool size
  serverSelectionTimeoutMS: 5000,    // Fail fast if server unreachable
  socketTimeoutMS: 45000,            // Close idle sockets
});
```

### Connection Rules

1. **Always configure connection pool size** (default 10)
2. **Always set server selection timeout** (5s recommended)
3. **Always set socket timeout** (45s recommended)
4. **Always handle connection errors** in startup
5. **Always disconnect gracefully** on shutdown

### Graceful Shutdown

```typescript
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server?.close();
  await destroyCache().catch(() => {});
  await disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

## Branch Models (db.ts)

### BranchModels Interface

```typescript
// server/src/models/db.ts
import mongoose, { type Model } from "mongoose";
import { Schema } from "mongoose";

const branchModelCache = new Map<string, BranchModels>();

export interface BranchModels {
  Customer: Model<any>;
  Visit: Model<any>;
  Prescription: Model<any>;
  Order: Model<any>;
  Bill: Model<any>;
  Payment: Model<any>;
  Inventory: Model<any>;
  Delivery: Model<any>;
  Settings: Model<any>;
  Todo: Model<any>;
}
```

### Lazy Schema Loading

Schemas are loaded lazily to avoid circular dependencies:

```typescript
let schemas: Record<string, Schema> | null = null;

function loadSchemas() {
  if (schemas) return schemas;
  schemas = {
    Customer: require("./customer").CustomerSchema,
    Visit: require("./visit").VisitSchema,
    Prescription: require("./prescription").PrescriptionSchema,
    Order: require("./order").OrderSchema,
    Bill: require("./bill").BillSchema,
    Payment: require("./payment").PaymentSchema,
    Inventory: require("./inventory").InventorySchema,
    Delivery: require("./delivery").DeliverySchema,
    Settings: require("./settings").SettingsSchema,
    Todo: require("./todo").TodoSchema,
  };
  return schemas;
}
```

### Model Registration Per Branch

```typescript
function registerModels(conn: mongoose.Connection): BranchModels {
  const s = loadSchemas();

  function getModel<T>(name: string, schema: Schema): Model<T> {
    if (conn.models[name]) return conn.models[name] as Model<T>;
    return conn.model<T>(name, schema);
  }

  return {
    Customer: getModel("Customer", s.Customer),
    Visit: getModel("Visit", s.Visit),
    Prescription: getModel("Prescription", s.Prescription),
    Order: getModel("Order", s.Order),
    Bill: getModel("Bill", s.Bill),
    Payment: getModel("Payment", s.Payment),
    Inventory: getModel("Inventory", s.Inventory),
    Delivery: getModel("Delivery", s.Delivery),
    Settings: getModel("Settings", s.Settings),
    Todo: getModel("Todo", s.Todo),
  };
}
```

### Branch Model Cache

Branch models are cached per database name to avoid re-registering:

```typescript
export function getBranchModels(dbName: string): BranchModels {
  if (!branchModelCache.has(dbName)) {
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    const models = registerModels(conn);
    branchModelCache.set(dbName, models);
  }
  return branchModelCache.get(dbName)!;
}

export function clearBranchCache() {
  branchModelCache.clear();
}
```

**Key Details**:
- `useDb(dbName, { noListener: true })` creates a lightweight connection to a different database on the same MongoDB server
- The `{ noListener: true }` option prevents the new connection from listening to the main connection events
- Models are cached to avoid creating duplicate model registrations on the same connection

## Branch Proxy System

### Request Context (AsyncLocalStorage)

```typescript
// server/src/utils/requestContext.ts
import { AsyncLocalStorage } from "async_hooks";
import type { BranchModels } from "../models/db";

export interface RequestContext {
  branchModels?: BranchModels;
  branchId?: string;
  branchName?: string;
}

export const ctx = new AsyncLocalStorage<RequestContext>();

export function getCtx(): RequestContext | undefined {
  return ctx.getStore();
}

export function requireCtx(): RequestContext {
  const context = getCtx();
  if (!context) throw new Error("Request context not available - missing branch scope");
  return context;
}
```

**How AsyncLocalStorage Works**:
1. Each incoming HTTP request gets its own execution context
2. The `branchScope` middleware stores the branch models in this context
3. Any code running within the same request can access the context via `getCtx()`
4. The context is automatically cleaned up when the request finishes
5. No need to pass context through function parameters

### Branch Proxy (withBranch)

```typescript
// server/src/utils/branchProxy.ts
import { getCtx } from "./requestContext";
import type { BranchModels } from "../models/db";

export function withBranch<T extends Record<string, any>>(
  defaultModel: T,
  key: keyof BranchModels
): T {
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

**How the Proxy Works**:
1. Each model file exports a proxied version: `export const Customer = withBranch(_Customer, "Customer")`
2. When any property is accessed on `Customer` (e.g., `Customer.find()`), the Proxy intercepts
3. It checks the AsyncLocalStorage context for branch-specific models
4. If branch context exists, it returns the branch-scoped model method
5. If no branch context, it falls back to the default (root) model
6. The `construct` trap handles `new Customer(...)` for document creation

### Model File Pattern

```typescript
// server/src/models/customer.ts
import { Schema, model } from "mongoose";
import { withBranch } from "../utils/branchProxy";

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

CustomerSchemaObj.index({ totalSpent: -1 });
CustomerSchemaObj.index({ createdAt: -1 });

export const CustomerSchema = CustomerSchemaObj;
const _Customer = model("Customer", CustomerSchemaObj);
export const Customer = withBranch(_Customer, "Customer");
```

**Important**: Always export both the raw schema (for branch registration) and the proxied model (for route usage).

### Branch Scope Middleware

```typescript
// server/src/middleware/branch.ts
import { Response, NextFunction } from "express";
import { Branch } from "../models/branch";
import { getBranchModels, type BranchModels } from "../models/db";
import { ctx, type RequestContext } from "../utils/requestContext";
import type { AuthRequest } from "./auth";

export interface BranchRequest extends AuthRequest {
  branchId?: string;
  branchDb?: string;
  branchName?: string;
  branchModels?: BranchModels;
}

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

**Critical Detail**: `ctx.run(requestCtx, () => next())` wraps the entire downstream middleware chain inside the AsyncLocalStorage context. This ensures all code running during the request has access to the branch models.

### Route Registration with Branch Scope

```typescript
// server/src/routes/index.ts
router.use("/customers", branchScope, customers);
router.use("/orders", branchScope, orders);
router.use("/bills", branchScope, bills);
router.use("/payments", branchScope, payments);
router.use("/inventory", branchScope, inventory);
// Branch-scoped routes use branchScope at the router level

router.use("/auth", auth);           // No branch scope (root DB)
router.use("/branches", branches);   // No branch scope (root DB)
router.use("/cache", cacheAdmin);    // No branch scope
```

## Schema Design Patterns

### Denormalized Fields

The system denormalizes frequently-read aggregate data for performance:

```typescript
// Customer denormalized fields
{
  totalVisits: { type: Number, default: 0 },    // Updated via $inc on visit creation
  totalSpent: { type: Number, default: 0 },      // Updated via $inc on bill creation
  pendingAmount: { type: Number, default: 0 },   // Updated via $inc on payment/bill changes
}
```

**Tradeoff**: Write complexity for read simplicity. These fields are updated atomically with `$inc` to avoid race conditions.

### Embedded Subdocuments

Bill items are embedded as subdocuments:

```typescript
const billItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const billSchema = new Schema({
  billNumber: { type: String, required: true, index: true, unique: true },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  items: [billItemSchema],
  // ... more fields
}, { timestamps: true });
```

### References vs Embedding Rules

| Pattern | Use When | Example |
|---------|----------|---------|
| Reference | Data accessed independently | Order references Customer |
| Reference | Data is large or grows | Visit references Customer |
| Embed | Data always accessed together | Bill embeds BillItems |
| Embed | Data is small and fixed-size | Prescription embeds EyeSchema |

## Indexing Strategy

### Existing Indexes

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
orderSchema.index({ createdAt: -1 });

// Bill indexes
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ customerId: 1, createdAt: -1 });
billSchema.index({ pendingAmount: 1 });
billSchema.index({ createdAt: -1 });
```

### Index Rules

1. **Always index fields** used in WHERE clauses
2. **Always use compound indexes** for multi-field queries (most selective first)
3. **Always index foreign keys** (customerId, billId, etc.)
4. **Never over-index** - each index slows writes and consumes memory
5. **Use sparse indexes** for optional fields that may be null
6. **Monitor slow queries** with MongoDB profiler or `explain()`

### Compound Index Patterns

```typescript
// Query: orders by customer, sorted by date (most recent first)
orderSchema.index({ customerId: 1, createdAt: -1 });

// Query: orders by status, sorted by date
orderSchema.index({ status: 1, createdAt: -1 });

// Query: bills by customer with pending amount
billSchema.index({ customerId: 1, pendingAmount: 1 });
```

## Query Patterns

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

### Search with Regex

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const q = req.query.q as string;
const filter = q
  ? {
      $or: [
        { sku: { $regex: escapeRegex(q), $options: "i" } },
        { brand: { $regex: escapeRegex(q), $options: "i" } },
        { model: { $regex: escapeRegex(q), $options: "i" } },
      ],
    }
  : {};
```

**WARNING**: Always escape regex special characters to prevent ReDoS attacks.

### Date Range Queries

```typescript
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

### Atomic Updates

```typescript
// Increment customer stats
await Customer.findByIdAndUpdate(customerId, {
  $inc: { totalSpent: total, pendingAmount },
});

// Decrement on payment
await Customer.findByIdAndUpdate(customerId, {
  $inc: { pendingAmount: -amount },
});

// Stock adjustment
await Inventory.findByIdAndUpdate(itemId, {
  $inc: { quantity: qty },
});
```

## Aggregation Pipelines

### Dashboard Stats

```typescript
// Revenue for today
const todaySales = await Bill.aggregate([
  { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
  { $group: { _id: null, total: { $sum: "$totalAmount" } } },
]);

// Daily sales for last 30 days
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

// Payment mode breakdown
const paymentModeSplit = await Payment.aggregate([
  { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
  { $group: { _id: "$paymentMode", total: { $sum: "$amount" }, count: { $sum: 1 } } },
]);

// Order status distribution
const orderStatusCounts = await Order.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
]);
```

### Lookup (Join)

```typescript
// Pending payments with bill info
const pendingPayments = await Payment.aggregate([
  {
    $lookup: {
      from: "bills",
      localField: "billId",
      foreignField: "_id",
      as: "bill",
    },
  },
  { $unwind: { path: "$bill", preserveNullAndEmptyArrays: true } },
  { $match: { "bill.pendingAmount": { $gt: 0 } } },
  { $group: { _id: null, total: { $sum: "$bill.pendingAmount" } } },
]);
```

## Cascade Operations

### Customer Deletion

```typescript
export async function remove(req: Request, res: Response) {
  const customer = await Customer.findByIdAndDelete(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
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

**Rule**: Always delete dependent records before the parent record (most dependent first).

## Performance Patterns

### Lean Queries

```typescript
// BAD: Returns full Mongoose documents (slow, memory-heavy)
const customers = await Customer.find();

// GOOD: Returns plain JavaScript objects (fast, lightweight)
const customers = await Customer.find().lean();
```

### Projections

```typescript
// BAD: Returns all fields
const customer = await Customer.findById(id);

// GOOD: Returns only needed fields
const customer = await Customer.findById(id).select("name mobile totalSpent");
```

### Batch Queries

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

## Bad Examples

```typescript
// BAD: No error handling on branch lookup
const branch = await Branch.findById(branchId);
const models = getBranchModels(branch.dbName); // branch could be null

// BAD: No regex escaping in search
const filter = { name: { $regex: search, $options: "i" } }; // ReDoS vulnerability

// BAD: N+1 in dashboard
for (const id of customerIds) {
  const total = await Bill.aggregate([
    { $match: { customerId: id } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
}

// BAD: Deleting without cascade
await Customer.findByIdAndDelete(id); // Leaves orphaned orders, bills, etc.

// BAD: Using find() without lean() for read-only queries
const customers = await Customer.find().sort({ createdAt: -1 }); // Unnecessary overhead
```

## Good Examples

```typescript
// GOOD: Proper branch lookup with validation
const branch = await Branch.findById(branchId).lean();
if (!branch || !branch.isActive) {
  throw new AppError(404, "Branch not found or inactive");
}
const models = getBranchModels(branch.dbName);

// GOOD: Escaped regex search
const filter = { name: { $regex: escapeRegex(search), $options: "i" } };

// GOOD: Parallel aggregation queries
const [todaySales, weekSales, monthSales] = await Promise.all([
  Bill.aggregate([{ $match: { createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
  Bill.aggregate([{ $match: { createdAt: { $gte: weekStart, $lt: today } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
  Bill.aggregate([{ $match: { createdAt: { $gte: monthStart, $lt: today } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
]);

// GOOD: Cascade deletion
await Promise.all([
  Visit.deleteMany({ customerId }),
  Order.deleteMany({ customerId }),
  Bill.deleteMany({ customerId }),
]);
await Customer.findByIdAndDelete(customerId);

// GOOD: Lean queries for read-only
const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Database-per-branch | Complete data isolation | More connections, more complexity |
| Denormalized totals | Fast reads, no aggregation needed | Write complexity, potential inconsistency |
| Proxy-based routing | Transparent branch routing | Performance overhead on every model access |
| Embedded BillItems | Single query for full bill | Cannot query items independently |
| Regex search | Flexible text search | ReDoS risk if not escaped |
| `lean()` everywhere | Better performance | No Mongoose document methods |

## Cross-References

- **Database schema**: See `docs/12-database.md`
- **Express middleware**: See `docs/11-express.md`
- **Performance optimization**: See `docs/21-performance.md`
- **Caching strategy**: See `docs/24-caching.md`
- **Security practices**: See `docs/22-security.md`

## AI Instructions

When working on MongoDB/Mongoose code:
1. Always use `lean()` for read-only queries
2. Always escape regex in search queries
3. Always use `$inc` for atomic counter updates
4. Always handle cascade operations on delete
5. Always validate branch context before accessing branch models
6. Always use compound indexes for multi-field queries
7. Always use projections to limit returned fields
8. Never use N+1 queries - use `$in` or aggregation
9. Never skip error handling on database operations
10. Always run linting after changes
