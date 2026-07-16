# Database Patterns — KMJ Optical ERP

> Reference guide for all Mongoose/MongoDB conventions used in the KMJ Optical ERP backend.

---

## 1. Schema Design Patterns with Mongoose

**Purpose:** Define consistent, well-structured schemas with proper types, defaults,
enums, and relationships.

**When to use:** Every new Mongoose model.

### Basic Schema with Timestamps

```ts
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

### Schema with ObjectId References

```ts
// server/src/models/order.ts
const OrderSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
    visitId: { type: Types.ObjectId, ref: "Visit" },
    frame: { type: String },
    lens: { type: String },
    coating: { type: String },
    quantity: { type: Number, default: 1 },
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
  },
  { timestamps: true }
);
```

### Schema with Embedded Subdocuments

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
```

### Schema with Deeply Nested Subdocuments

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
```

### Schema with Enums and Constraints

```ts
// server/src/models/payment.ts
const PaymentSchemaObj = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "Customer", required: true },
    billId: { type: Types.ObjectId, ref: "Bill" },
    amount: { type: Number, required: true, min: [0.01, "Amount must be positive"] },
    paymentMode: {
      type: String,
      enum: ["Cash","UPI","Card","Bank Transfer","नकद","कार्ड","बैंक","बीमा","Insurance"],
      default: "Cash"
    },
    paymentDate: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { timestamps: true }
);
```

### Schema without Branch Proxy (Global Models)

```ts
// server/src/models/user.ts — NOT branch-scoped
const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    role: { type: String, enum: ["owner", "staff", "warehouse"], default: "owner" },
    branches: [{ type: Types.ObjectId, ref: "Branch" }],
  },
  { timestamps: true }
);

export const User = model("User", UserSchema); // No withBranch wrapper
```

### Anti-Pattern

```ts
// WRONG — no defaults, undefined values propagate
const OrderSchema = new Schema({ quantity: { type: Number } }); // Missing default: 1

// WRONG — no enum validation
const OrderSchema = new Schema({ status: { type: String } }); // Any string accepted

// WRONG — timestamps not enabled
const CustomerSchema = new Schema({ name: String }, { timestamps: false });
```

### Tradeoffs

- `timestamps: true` is universal — every schema gets `createdAt` and `updatedAt`.
- Default values (`default: 0`, `default: []`, `default: "Draft"`) prevent undefined
  fields in API responses.
- Enum validation at the schema level catches invalid values before they reach the database.
- `required: true` on critical fields (customerId, name) provides a safety net, but
  application-level validation (Zod) is the primary guard.

### Related Patterns

- Index Patterns (section 2)
- Branch Proxy Patterns (backend-patterns.md)

---

## 2. Index Patterns

**Purpose:** Create indexes for fast queries on frequently accessed fields.

**When to use:** Every field used in `find()`, `sort()`, `countDocuments()`, or
`aggregate()`.

### Single-Field Indexes

```ts
// Customer — individual field lookups
CustomerSchemaObj.index({ customerId: 1 }); // Unique customer ID
CustomerSchemaObj.index({ name: 1 });       // Name search
CustomerSchemaObj.index({ mobile: 1 });     // Phone lookup

// Bill — unique bill number
BillSchemaObj.index({ billNumber: 1 }, { unique: true });

// Inventory — unique SKU
InventorySchemaObj.index({ sku: 1 }, { unique: true });
```

### Compound Indexes

```ts
// Order — most common query: orders for a customer, newest first
OrderSchemaObj.index({ customerId: 1, createdAt: -1 });

// Order — filter by status, sorted by date
OrderSchemaObj.index({ status: 1, createdAt: -1 });

// Order — filter by classification, sorted by date
OrderSchemaObj.index({ classification: 1, createdAt: -1 });

// Bill — bills for a customer, newest first
BillSchemaObj.index({ customerId: 1, createdAt: -1 });

// Payment — payments for a customer, newest first
PaymentSchemaObj.index({ customerId: 1, paymentDate: -1 });

// Prescription — prescriptions for a customer
PrescriptionSchemaObj.index({ customerId: 1, createdAt: -1 });

// Delivery — filter by status and expected date
DeliverySchemaObj.index({ status: 1, expectedDeliveryDate: 1 });
```

### Sort Indexes

```ts
// Most list queries sort by createdAt descending
CustomerSchemaObj.index({ createdAt: -1 });
OrderSchemaObj.index({ createdAt: -1 });
BillSchemaObj.index({ createdAt: -1 });
PaymentSchemaObj.index({ paymentDate: -1 });
VisitSchemaObj.index({ visitDate: -1 });
```

### Special-Purpose Indexes

```ts
// Dashboard queries — pending amount sorting
BillSchemaObj.index({ pendingAmount: 1 });

// Customer spending ranking
CustomerSchemaObj.index({ totalSpent: -1 });

// Delivery by order
DeliverySchemaObj.index({ orderId: 1 });

// Payment by bill
PaymentSchemaObj.index({ billId: 1 });
```

### Index Usage Examples

```ts
// Uses: { customerId: 1, createdAt: -1 }
await Order.find({ customerId: id }).sort({ createdAt: -1 }).limit(500);

// Uses: { status: 1, createdAt: -1 }
await Order.find({ status: "Ready" }).sort({ createdAt: -1 });

// Uses: { pendingAmount: 1 }
await Bill.find({ pendingAmount: { $gt: 0 } }).sort({ pendingAmount: -1 }).limit(5);

// Uses: { createdAt: -1 }
await Customer.find().sort({ createdAt: -1 }).limit(5);
```

### Anti-Pattern

```ts
// WRONG — no index on customerId, every query scans entire collection
const OrderSchema = new Schema({ customerId: ObjectId });
await Order.find({ customerId: someId }); // Full collection scan

// WRONG — redundant indexes
OrderSchemaObj.index({ customerId: 1 });
OrderSchemaObj.index({ customerId: 1, createdAt: -1 }); // The first index is redundant
```

### Tradeoffs

- Compound indexes are ordered from most selective to least selective (field → date).
- `{ createdAt: -1 }` (descending) matches the most common sort order.
- Too many indexes slow down writes — each insert/update must update all indexes.
- MongoDB uses a single index per query — compound indexes must match the query pattern.

### Related Patterns

- Query Patterns (section 3)
- Performance Optimization (performance-patterns.md)

---

## 3. Query Patterns

**Purpose:** Standard Mongoose query patterns used throughout the codebase.

**When to use:** Every database interaction.

### Find with Filter and Sort

```ts
// Simple list
const list = await Customer.find(filter).sort({ createdAt: -1 }).limit(1000).lean();

// With populate
const list = await Order.find(filter)
  .populate("customerId", "name mobile")
  .sort({ createdAt: -1 })
  .limit(500);

// With multiple populates
const list = await Delivery.find(filter)
  .populate("customerId", "name mobile")
  .populate("orderId", "frame lens status")
  .sort({ createdAt: -1 })
  .limit(200)
  .lean();
```

### Find by ID

```ts
const customer = await Customer.findById(req.params.id).lean();
if (!customer) throw new AppError(404, "Customer not found");
```

### Find One with Sort

```ts
// Get latest bill for a customer
const bill = await Bill.findOne({ customerId: custId })
  .sort({ createdAt: -1 })
  .select("pendingAmount totalAmount advancePaid billNumber");
```

### Create

```ts
const customer = await Customer.create({ ...req.body, mobile: mobile.trim() });

// Or with new + save
const order = new Order(p as any);
await order.save();
```

### Update

```ts
// findByIdAndUpdate with $set
const customer = await Customer.findByIdAndUpdate(
  req.params.id,
  { $set: req.body },
  { new: true, runValidators: true }
).lean();

// Increment
await Customer.findByIdAndUpdate(id, { $inc: { totalSpent: total } });

// Decrement (negative increment)
await Customer.findByIdAndUpdate(id, { $inc: { pendingAmount: -collectPayment } });

// Multiple increments
await Customer.findByIdAndUpdate(bill.customerId, {
  $inc: { totalSpent: totalDiff, pendingAmount: pendingDiff },
});
```

### Delete

```ts
// Single document
const customer = await Customer.findByIdAndDelete(req.params.id).lean();

// Multiple documents (cascade)
await Promise.all([
  Visit.deleteMany({ customerId }),
  Order.deleteMany({ customerId }),
  Bill.deleteMany({ customerId }),
  Prescription.deleteMany({ customerId }),
  Payment.deleteMany({ customerId }),
  Delivery.deleteMany({ customerId }),
]);
```

### Count

```ts
const count = await Customer.countDocuments();
const lowStock = await Inventory.countDocuments({ quantity: { $lte: 5 } });
const todayOrders = await Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
```

### Anti-Pattern

```ts
// WRONG — no lean() on read-only queries
const list = await Customer.find(); // Returns full Mongoose documents (slow)

// WRONG — no limit
const list = await Order.find(); // Could return thousands of documents

// WRONG — using find() when findById() is appropriate
const customer = (await Customer.find({ _id: req.params.id }))[0];
```

### Tradeoffs

- `.lean()` is used on almost every read query — returns plain JavaScript objects instead
  of Mongoose documents, significantly reducing memory and CPU overhead.
- `.limit()` is always used to prevent unbounded result sets.
- `.populate("customerId", "name mobile")` only selects needed fields — avoids over-fetching.
- `$inc` is used for atomic counter updates — avoids read-modify-write race conditions.

### Related Patterns

- Index Patterns (section 2)
- Pagination Patterns (section 5)

---

## 4. Aggregation Patterns

**Purpose:** Complex queries that group, join, or compute aggregate data.

**When to use:** Dashboard statistics, reports, and summary data.

### Simple Group Aggregation

```ts
// Total sales today
const todaySales = await Bill.aggregate([
  { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
  { $group: { _id: null, total: { $sum: "$totalAmount" } } },
]);
// Result: [{ _id: null, total: 45000 }]
```

### Date-Based Grouping

```ts
// Daily sales for last 30 days
const dailySalesData = await Bill.aggregate([
  { $match: { createdAt: { $gte: thirtyDaysAgo, $lt: tomorrow } } },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      total: { $sum: "$totalAmount" },
    },
  },
  { $sort: { _id: 1 } },
]);
// Result: [{ _id: "2024-01-15", total: 12000 }, ...]
```

### Enum-Based Grouping

```ts
// Payment mode breakdown
const paymentModeData = await Payment.aggregate([
  { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
  { $group: { _id: "$paymentMode", total: { $sum: "$amount" }, count: { $sum: 1 } } },
]);
// Result: [{ _id: "Cash", total: 30000, count: 15 }, { _id: "UPI", total: 15000, count: 8 }]
```

### Lookup (Join) Aggregation

```ts
// Pending payments with bill details
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

### Count by Status

```ts
// Order status distribution
const orderStatusData = await Order.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
]);
// Result: [{ _id: "Draft", count: 5 }, { _id: "Ready", count: 12 }, ...]
```

### Customer Summary Aggregation

```ts
// Total billed for a specific customer
const billTotal = await Bill.aggregate([
  { $match: { customerId: req.params.id } },
  { $group: { _id: null, total: { $sum: "$totalAmount" } } },
]);
// Result: [{ _id: null, total: 25000 }]
```

### Inventory Value Aggregation

```ts
// Total inventory value
const totalValueResult = await Inventory.aggregate([
  { $group: { _id: null, total: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } } } },
]);
// Result: [{ _id: null, total: 150000 }]
```

### Anti-Pattern

```ts
// WRONG — fetching all documents and computing in JavaScript
const bills = await Bill.find({ createdAt: { $gte: today } });
const total = bills.reduce((sum, b) => sum + b.totalAmount, 0); // Slow!

// WRONG — no $match before $group (processes entire collection)
const result = await Bill.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
]);
```

### Tradeoffs

- Aggregation pipelines always start with `$match` to reduce the dataset before grouping.
- `$lookup` is used sparingly — only for dashboard statistics, not for regular queries.
- `$unwind` with `preserveNullAndEmptyArrays: true` prevents losing documents with
  null/missing lookup fields.
- Results from aggregation are plain objects, not Mongoose documents — no `.lean()` needed.

### Related Patterns

- Dashboard Route (api-patterns.md)
- Index Patterns (section 2)

---

## 5. Pagination Patterns

**Purpose:** Efficient data retrieval with skip/limit pagination for large datasets.

**When to use:** List endpoints that can return hundreds or thousands of records.

### Skip/Limit Pagination

```ts
// server/src/controllers/customerController.ts
const { page = "1", limit = "1000" } = req.query;
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
```

### Fixed-Limit Pagination (Most Routes)

```ts
// Orders — capped at 500
const list = await Order.find(filter)
  .populate("customerId", "name mobile")
  .sort({ createdAt: -1 })
  .limit(500);

// Inventory — capped at 200
const list = await Inventory.find(filter).limit(200).lean();

// Payments — capped at 500
const list = await Payment.find(filter)
  .populate("customerId", "name mobile customerId")
  .sort({ paymentDate: -1 })
  .limit(500)
  .lean();

// Visits — capped at 200
const list = await Visit.find(filter).sort({ visitDate: -1 }).limit(200).lean();
```

### Anti-Pattern

```ts
// WRONG — no limit at all
const list = await Order.find(filter).sort({ createdAt: -1 });
// Could return 10,000+ documents

// WRONG — no countDocuments alongside skip/limit
const data = await Customer.find(filter).skip(skip).limit(limit);
// Can't tell frontend total number of pages
```

### Tradeoffs

- Full skip/limit (customers) is only used on the customers page because it has search
  and needs to show "X of Y results."
- Fixed-limit `.limit(500)` is simpler and sufficient for bounded datasets — optical shops
  rarely exceed 500 orders per branch.
- `countDocuments()` runs in parallel with `find()` via `Promise.all` for efficiency.
- `.lean()` is always used with pagination to reduce memory overhead.

### Related Patterns

- API Pagination (api-patterns.md)
- Index Patterns (section 2)

---

## 6. Search Patterns

**Purpose:** Find records by partial text matching using regex or text indexes.

**When to use:** Search inputs that filter across multiple fields.

### Regex Search Across Multiple Fields

```ts
// server/src/controllers/customerController.ts
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

### Inventory Multi-Field Search

```ts
// server/src/routes/inventory.ts
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

### Phone Number Search

```ts
// Partial phone matching
if (phone) filter.mobile = { $regex: phone as string, $options: "i" };
```

### Client-Side Search (In-Memory)

```tsx
// client/src/pages/Customers.tsx
const filteredList = useMemo(() => {
  const q = searchQuery.trim();
  if (!q) return list;
  const lower = q.toLowerCase();
  return list.filter((c) =>
    c.name?.toLowerCase().includes(lower) || c.mobile?.includes(q) ||
    c.customerId?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower)
  );
}, [searchQuery, list]);
```

### Anti-Pattern

```ts
// WRONG — no escapeRegex, vulnerable to regex injection
filter.$or = [{ name: { $regex: q, $options: "i" } }];
// User could enter ".*" to match everything

// WRONG — case-sensitive search
filter.name = { $regex: "rahul" }; // Won't match "Rahul"
```

### Tradeoffs

- `$regex` with `escapeRegex` is safe and flexible but slower than text indexes on large
  collections.
- `$options: "i"` makes the search case-insensitive.
- Multi-field `$or` search is the standard pattern — covers name, phone, email, ID, etc.
- Client-side search (Customers page) is used when the full dataset is already loaded —
  avoids server round-trips.

### Related Patterns

- Index Patterns (section 2)
- Search API Patterns (api-patterns.md)

---

## 7. Denormalization Patterns

**Purpose:** Store computed/aggregated values on documents to avoid expensive queries on
every page load.

**When to use:** Frequently accessed summary data that would otherwise require aggregation.

### Customer Denormalized Fields

```ts
// server/src/models/customer.ts
const CustomerSchemaObj = new Schema({
  // ... other fields
  totalVisits: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 }
});
```

### Increment on Visit Creation

```ts
// server/src/routes/visits.ts
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const visit = await Visit.create({ ...p, visitDate: p.visitDate ? new Date(p.visitDate) : new Date() });
  await Customer.findByIdAndUpdate(p.customerId, { $inc: { totalVisits: 1 } });
  res.json({ success: true, data: visit });
}));
```

### Decrement on Visit Deletion

```ts
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const v = await Visit.findByIdAndDelete(req.params.id).lean();
  if (!v) throw new AppError(404, "Not found");
  await Customer.findByIdAndUpdate(v.customerId, { $inc: { totalVisits: -1 } });
}));
```

### Bill Total on Customer

```ts
// On bill creation
await Customer.findByIdAndUpdate(p.customerId, {
  $inc: { totalSpent: total, pendingAmount },
});

// On bill update — differential update
const totalDiff = newTotal - oldTotal;
const pendingDiff = newPending - oldPending;
await Customer.findByIdAndUpdate(bill.customerId, { $inc: customerUpdates });

// On bill deletion — reverse
await Customer.findByIdAndUpdate(b.customerId, {
  $inc: { totalSpent: -(b.totalAmount || 0), pendingAmount: -(b.pendingAmount || 0) },
});
```

### Payment on Customer

```ts
// On payment creation
await Customer.findByIdAndUpdate(p.customerId, {
  $inc: { pendingAmount: -p.amount },
});

// On payment deletion — reverse
await Customer.findByIdAndUpdate(p.customerId, { $inc: { pendingAmount: p.amount } });
```

### Recalculation Endpoint

```ts
// When denormalized data gets out of sync
router.post("/recalculate/customer-totals", authenticate, asyncHandler(async (req, res) => {
  // Recompute totalSpent, totalVisits, pendingAmount from source collections
  // ...
  res.json({ success: true, data: { updated: count } });
}));
```

### Anti-Pattern

```ts
// WRONG — computing totals on every page load
const customers = await Customer.find();
for (const c of customers) {
  c.totalSpent = await Bill.aggregate([
    { $match: { customerId: c._id } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
}
// N+1 query problem — extremely slow

// WRONG — not updating denormalized field when source changes
router.post("/bills", async (req, res) => {
  const bill = await Bill.create(req.body);
  // Missing: await Customer.findByIdAndUpdate(bill.customerId, { $inc: { totalSpent: bill.totalAmount } });
});
```

### Tradeoffs

- Denormalized fields (`totalVisits`, `totalSpent`, `pendingAmount`) make the customer
  list page fast — no aggregation needed.
- The tradeoff is consistency — denormalized data can get out of sync if mutations
  are not properly handled. The recalculation endpoint fixes this.
- `$inc` is atomic — no read-modify-write race conditions.
- Every mutation that affects these fields (create/update/delete bill, visit, payment)
  must update the customer document.

### Related Patterns

- Query Patterns (section 3)
- Cache Invalidation (backend-patterns.md)

---

## 8. Multi-Tenant Query Patterns (Branch Proxy)

**Purpose:** Transparent database switching per branch using Mongoose Proxy pattern.

**When to use:** Every query on branch-scoped resources.

### How Branch Proxy Works

```ts
// When no branch context (default database):
Customer.find() → queries default database

// When branch context is set (branch database):
Customer.find() → Proxy intercepts → queries branch-specific database
```

### Branch Model Registration

```ts
// server/src/models/db.ts
export function getBranchModels(dbName: string): BranchModels {
  if (!branchModelCache.has(dbName)) {
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    const models = registerModels(conn);
    branchModelCache.set(dbName, models);
  }
  return branchModelCache.get(dbName)!;
}
```

### Context Propagation

```ts
// server/src/middleware/branch.ts
const requestCtx: RequestContext = {
  branchId: req.branchId,
  branchName: req.branchName,
  branchModels,
};
ctx.run(requestCtx, () => next());
```

### Proxy Interception

```ts
// server/src/utils/branchProxy.ts
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
}
```

### Cross-Branch Queries

```ts
// Some operations need to query the default database regardless of branch context
// User model is NOT wrapped with withBranch
export const User = model("User", UserSchema);

// Branch model is NOT wrapped with withBranch
export const Branch = model("Branch", BranchSchema);
```

### Anti-Pattern

```ts
// WRONG — manually switching database in every route
router.get("/", asyncHandler(async (req, res) => {
  const branchId = req.headers["x-branch-id"];
  const conn = mongoose.connection.useDb(`branch_${branchId}`);
  const Model = conn.model("Customer", CustomerSchema);
  const list = await Model.find();
}));

// WRONG — using default model when branch context should be used
import { Customer } from "../models/customer"; // This is the proxy
// But if you bypass it:
const conn = mongoose.connection;
const list = await conn.model("Customer").find(); // Always queries default DB
```

### Tradeoffs

- The Proxy pattern is transparent — all existing code (`Customer.find()`) works unchanged
  whether branch scoping is active or not.
- `getCtx()` returns `undefined` outside of `ctx.run()` — the proxy falls back to the
  default model, which is correct for non-branch-scoped routes.
- `branchModelCache` prevents recreating models for the same branch — cached by dbName.
- `useDb(dbName, { noListener: true })` prevents event listener leaks from creating
  many connections.

### Related Patterns

- Branch Middleware (api-patterns.md)
- Request Context (backend-patterns.md)

---

## 9. Cascade Operation Patterns

**Purpose:** When a parent record is deleted, remove or update all related child records.

**When to use:** DELETE operations on records with foreign key relationships.

### Customer Cascade Delete

```ts
// server/src/controllers/customerController.ts
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

### Bill Cascade Delete with Customer Update

```ts
// server/src/routes/bills.ts
router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const b = await Bill.findByIdAndDelete(req.params.id).lean();
  if (!b) throw new AppError(404, "Not found");
  // Reverse customer denormalized totals
  await Customer.findByIdAndUpdate(b.customerId, {
    $inc: { totalSpent: -(b.totalAmount || 0), pendingAmount: -(b.pendingAmount || 0) },
  });
  await Promise.all([
    invalidateCache("/api/bills"),
    invalidateCache("/api/dashboard"),
  ]);
  res.json({ success: true, message: "Deleted" });
}));
```

### Payment Cascade Delete with Bill Update

```ts
// server/src/routes/payments.ts
router.delete("/:id", authenticate, audit, asyncHandler(async (req, res) => {
  const p = await Payment.findByIdAndDelete(req.params.id).lean();
  if (!p) throw new AppError(404, "Not found");
  // Reverse bill advance adjustment
  if (p.billId) {
    const bill = await Bill.findById(p.billId);
    if (bill) {
      bill.advancePaid = Math.max(0, (bill.advancePaid || 0) - p.amount);
      bill.pendingAmount = Math.max(0, (bill.totalAmount || 0) - bill.advancePaid);
      await bill.save();
    }
  }
  // Reverse customer pendingAmount
  await Customer.findByIdAndUpdate(p.customerId, { $inc: { pendingAmount: p.amount } });
}));
```

### Visit Cascade Delete with Customer Update

```ts
// server/src/routes/visits.ts
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const v = await Visit.findByIdAndDelete(req.params.id).lean();
  if (!v) throw new AppError(404, "Not found");
  await Customer.findByIdAndUpdate(v.customerId, { $inc: { totalVisits: -1 } });
}));
```

### Soft Delete (Branch Deactivation)

```ts
// server/src/routes/branches.ts — don't actually delete, just deactivate
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  ).lean();
  if (!branch) throw new AppError(404, "Branch not found");
  clearBranchCache();
  res.json({ success: true, message: "Branch deactivated" });
}));
```

### Anti-Pattern

```ts
// WRONG — deleting parent without cleaning up children
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  // Orphaned orders, bills, visits, etc. remain in the database
}));

// WRONG — not reversing denormalized totals
router.delete("/bills/:id", authenticate, asyncHandler(async (req, res) => {
  const bill = await Bill.findByIdAndDelete(req.params.id);
  // Missing: Customer.findByIdAndUpdate(bill.customerId, { $inc: { totalSpent: -bill.totalAmount } });
}));
```

### Tradeoffs

- All cascade deletes use `Promise.all` for parallel execution — faster than sequential.
- `deleteMany` is used instead of looping `deleteOne` — more efficient.
- Soft delete (branches) is used instead of hard delete when the record has historical
  significance.
- Cascade operations must be carefully tested — a missed cascade creates orphaned data.

### Related Patterns

- Denormalization Patterns (section 7)
- Cache Invalidation (backend-patterns.md)

---

## 10. Database Connection and Branch Model Management

**Purpose:** Manage MongoDB connections and branch-specific model instances.

**When to use:** Application startup and branch management.

### Branch Model Cache

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

export function clearBranchCache() {
  branchModelCache.clear();
}
```

### Lazy Schema Loading

```ts
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

### Model Registration

```ts
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

### Cache Invalidation on Branch Changes

```ts
// When a branch is created or updated
clearBranchCache(); // Forces re-creation of branch models on next request
```

### Anti-Pattern

```ts
// WRONG — creating new model instances on every request
router.get("/", asyncHandler(async (req, res) => {
  const conn = mongoose.connection.useDb("branch_abc");
  const Customer = conn.model("Customer", CustomerSchema); // New model every time!
  const list = await Customer.find();
}));

// WRONG — not caching branch models
// Creates new connection and models for every branch on every request
```

### Tradeoffs

- `branchModelCache` prevents creating new connections for the same branch — cached by
  dbName string.
- `clearBranchCache()` is called when branches are created/updated/deleted — forces cache
  refresh.
- Lazy schema loading (`loadSchemas()`) avoids circular dependency issues.
- `conn.models[name]` check prevents duplicate model registration errors.

### Related Patterns

- Branch Proxy (backend-patterns.md)
- Branch Scope Middleware (api-patterns.md)
