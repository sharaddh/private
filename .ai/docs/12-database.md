# 12 - Database

## Purpose

This document defines database architecture, patterns, and conventions for the KMJ Optical ERP MongoDB database. It covers schema design, indexing, relationships, and multi-tenant data isolation.

## Architecture Overview

### Database Strategy

The KMJ Optical ERP uses a **database-per-branch** architecture:

```
Root Database (kmj)
├── users
├── branches
└── baileys_auth_*

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

Branch Database (kmj_falke_bajar)
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

### Why Database-Per-Branch?

1. **Data Isolation**: Each branch's data is completely isolated
2. **Security**: Branch data cannot leak between branches
3. **Scalability**: Each branch database can be scaled independently
4. **Backup**: Individual branches can be backed up/restored independently
5. **Compliance**: Data residency requirements can be met per branch

## Schema Design

### Design Principles

1. **Denormalize when appropriate**: Duplicate data for read performance
2. **Embed related data**: When data is always accessed together
3. **Reference related data**: When data is accessed independently
4. **Use compound indexes**: For multi-field queries
5. **Set defaults**: For optional fields

### Customer Schema

```typescript
const customerSchema = new Schema({
  customerId: { type: String, index: true },
  name: { type: String, required: true, index: true },
  email: { type: String },
  age: { type: Number },
  gender: { type: String },
  mobile: { type: String, index: true },
  alternateMobile: { type: String },
  address: { type: String },
  city: { type: String },
  tags: [{ type: String, default: [] }],
  totalVisits: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0, index: { totalSpent: -1 } },
  pendingAmount: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes
customerSchema.index({ customerId: 1 });
customerSchema.index({ createdAt: -1 });
```

**Design Decisions**:
- `totalVisits`, `totalSpent`, `pendingAmount` are denormalized for read performance
- These fields are updated via `$inc` for atomicity
- Tradeoff: Write complexity for read simplicity

### Order Schema

```typescript
const orderSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'Visit' },
  frame: { type: String },
  frameBrand: { type: String },
  frameModel: { type: String },
  frameColor: { type: String },
  frameSize: { type: String },
  framePrice: { type: Number, default: 0 },
  lens: { type: String },
  lensBrand: { type: String },
  lensType: { type: String },
  lensIndex: { type: String },
  lensPrice: { type: Number, default: 0 },
  coating: { type: String },
  coatingPrice: { type: Number, default: 0 },
  accessories: [{ type: String, default: [] }],
  quantity: { type: Number, default: 1 },
  forwardedCount: { type: Number, default: 0 },
  deliveryDate: { type: Date },
  actualDeliveryDate: { type: Date },
  status: { 
    type: String, 
    enum: ['Draft', 'Ordered', 'In Lab', 'Ready', 'Delivered', 'Cancelled'],
    default: 'Draft'
  },
  labAssigned: { type: String },
  labExpectedDate: { type: Date },
  labRemarks: { type: String },
  reviewed: { type: Boolean, default: false },
  classification: { 
    type: String, 
    enum: ['pending', 'stock', 'buy', 'order'],
    default: 'pending'
  },
  rightLensStatus: { 
    type: String, 
    enum: ['pending', 'stock', 'buy', 'order'],
    default: 'pending'
  },
  leftLensStatus: { 
    type: String, 
    enum: ['pending', 'stock', 'buy', 'order'],
    default: 'pending'
  }
}, { timestamps: true });

// Indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ classification: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
```

**Design Decisions**:
- Frame and lens details are embedded (not referenced) for read performance
- `status` uses string enum for readability
- `classification` and `*LensStatus` track inventory requirements
- Tradeoff: Data duplication for query simplicity

### Bill Schema

```typescript
const billItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const billSchema = new Schema({
  billNumber: { type: String, required: true, index: true, unique: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'Visit' },
  items: [billItemSchema],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0, index: { pendingAmount: 1 } },
  totalAmount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['Active', 'Cancelled'],
    default: 'Active'
  }
}, { timestamps: true });

// Indexes
billSchema.index({ customerId: 1, createdAt: -1 });
billSchema.index({ createdAt: -1 });
```

**Design Decisions**:
- `billNumber` is unique per branch (not globally)
- `items` are embedded as subdocuments
- `pendingAmount` is denormalized for quick access
- Tradeoff: No global bill number uniqueness

## Indexing Strategy

### Index Types

```typescript
// Single field index
customerSchema.index({ mobile: 1 });

// Compound index
orderSchema.index({ customerId: 1, createdAt: -1 });

// Unique index
billSchema.index({ billNumber: 1 }, { unique: true });

// Sparse index
customerSchema.index({ email: 1 }, { sparse: true });

// TTL index (for session data)
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
```

### Index Rules

1. **Always index fields** used in queries
2. **Always use compound indexes** for multi-field queries
3. **Always put selective fields first** in compound indexes
4. **Never over-index** - each index slows writes
5. **Always monitor index usage** with `explain()`

### Common Query Patterns

```typescript
// Customer lookup by mobile
customerSchema.index({ mobile: 1 });

// Customer list with search
customerSchema.index({ name: 'text', mobile: 'text' });

// Order history by customer
orderSchema.index({ customerId: 1, createdAt: -1 });

// Orders by status
orderSchema.index({ status: 1, createdAt: -1 });

// Bills with pending amount
billSchema.index({ pendingAmount: 1 });

// Recent activity
orderSchema.index({ createdAt: -1 });
```

## Relationships

### Reference Relationships

```typescript
// Order references Customer
orderSchema.index({ customerId: 1 });

// Bill references Customer
billSchema.index({ customerId: 1 });

// Payment references Customer and Bill
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ billId: 1 });

// Visit references Customer
visitSchema.index({ customerId: 1 });
```

### Population

```typescript
// Populate single reference
const order = await Order.findById(id).populate('customerId');

// Populate multiple references
const order = await Order.findById(id)
  .populate('customerId')
  .populate('visitId');

// Select specific fields
const order = await Order.findById(id)
  .populate('customerId', 'name mobile');
```

### Cascade Operations

```typescript
// Delete customer and all related data
router.delete('/:id', async (req, res) => {
  const customerId = req.params.id;
  
  // Delete in order (most dependent first)
  await Prescription.deleteMany({ customerId });
  await Visit.deleteMany({ customerId });
  await Order.deleteMany({ customerId });
  await Bill.deleteMany({ customerId });
  await Payment.deleteMany({ customerId });
  await Delivery.deleteMany({ customerId });
  await Customer.findByIdAndDelete(customerId);
  
  res.json(success({ message: 'Customer deleted' }));
});
```

## Multi-Tenant Architecture

### Branch Model Proxy

```typescript
// models/db.ts
const branchModelsCache = new Map<string, BranchModels>();

export function getBranchModels(dbName: string): BranchModels {
  if (branchModelsCache.has(dbName)) {
    return branchModelsCache.get(dbName)!;
  }

  const conn = mongoose.connection.useDb(dbName);
  
  const models = {
    Customer: conn.model('Customer', customerSchema),
    Visit: conn.model('Visit', visitSchema),
    Prescription: conn.model('Prescription', prescriptionSchema),
    Order: conn.model('Order', orderSchema),
    Bill: conn.model('Bill', billSchema),
    Payment: conn.model('Payment', paymentSchema),
    Inventory: conn.model('Inventory', inventorySchema),
    Delivery: conn.model('Delivery', deliverySchema),
    Settings: conn.model('Settings', settingsSchema),
    Todo: conn.model('Todo', todoSchema)
  };

  branchModelsCache.set(dbName, models);
  return models;
}
```

### Branch Proxy

```typescript
// utils/branchProxy.ts
export function withBranch<T>(model: T): T {
  return new Proxy(model as any, {
    get: (target, prop) => {
      const ctx = getCtx();
      if (ctx?.branchModels) {
        const branchModel = ctx.branchModels[prop as keyof BranchModels];
        if (typeof branchModel === 'function') {
          return branchModel.bind(branchModel);
        }
        return branchModel;
      }
      return Reflect.get(target, prop);
    }
  });
}
```

### AsyncLocalStorage

```typescript
// utils/asyncLocalStorage.ts
import { AsyncLocalStorage } from 'async_hooks';

interface Store {
  branchModels: BranchModels;
}

export const asyncLocalStorage = new AsyncLocalStorage<Store>();

export function getCtx(): Store | undefined {
  return asyncLocalStorage.getStore();
}
```

## Query Patterns

### Pagination

```typescript
async function paginate<T>(
  model: any,
  page: number,
  limit: number,
  filter: any = {},
  sort: any = { createdAt: -1 }
): Promise<{ data: T[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    model.countDocuments(filter)
  ]);

  return { data, total, page, limit };
}
```

### Search

```typescript
async function searchCustomers(search: string) {
  const regex = new RegExp(search, 'i');
  return Customer.find({
    $or: [
      { name: regex },
      { mobile: regex },
      { email: regex }
    ]
  });
}
```

### Aggregation

```typescript
// Dashboard statistics
async function getDashboardStats(branchId: string) {
  const stats = await Order.aggregate([
    { $match: { branchId } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$totalAmount' }
    }}
  ]);
  return stats;
}
```

### Transactions

```typescript
// Atomic operations
async function processPayment(billId: string, amount: number) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await Bill.findByIdAndUpdate(
      billId,
      { $inc: { advancePaid: amount, pendingAmount: -amount } },
      { session }
    );

    await Customer.findByIdAndUpdate(
      bill.customerId,
      { $inc: { pendingAmount: -amount } },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

## Migration Strategy

### Migration File Structure

```typescript
// migrations/migrate-legacy.ts
import mongoose from 'mongoose';

export async function up() {
  // Forward migration
  await mongoose.connection.db.collection('customers').updateMany(
    {},
    { $set: { totalVisits: 0, totalSpent: 0, pendingAmount: 0 } }
  );
}

export async function down() {
  // Reverse migration
  await mongoose.connection.db.collection('customers').updateMany(
    {},
    { $unset: { totalVisits: '', totalSpent: '', pendingAmount: '' } }
  );
}
```

### Migration Rules

1. **Always write reversible migrations** (up and down)
2. **Always test migrations** on sample data
3. **Always backup before migration**
4. **Never drop collections** without confirmation
5. **Always document migration purpose**

## Performance

### Query Optimization

```typescript
// BAD: N+1 query
const customers = await Customer.find();
for (const customer of customers) {
  customer.orders = await Order.find({ customerId: customer._id });
}

// GOOD: Batch query
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });
// Group orders by customerId in memory
```

### Projection

```typescript
// BAD: Return all fields
const customers = await Customer.find();

// GOOD: Return only needed fields
const customers = await Customer.find().select('name mobile totalSpent');
```

### Lean Queries

```typescript
// BAD: Return Mongoose documents
const customers = await Customer.find();

// GOOD: Return plain objects (faster)
const customers = await Customer.find().lean();
```

## Backup Strategy

### Automated Backups

```bash
# MongoDB backup
mongodump --uri="mongodb://localhost:27017/kmj" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/kmj" /backups/20240101
```

### Backup Rules

1. **Daily backups** for production
2. **Weekly backups** for development
3. **Before migrations** always
4. **Test restores** regularly
5. **Store backups** offsite

## Cross-References

- **MongoDB patterns**: See `docs/13-mongodb.md`
- **Database patterns**: See `patterns/database-patterns.md`
- **Performance**: See `docs/21-performance.md`
- **Security**: See `docs/22-security.md`
- **Data flow**: See `knowledge/data-flow.md`

## AI Instructions

When working on database code:
1. Always design schemas with proper indexes
2. Always use compound indexes for multi-field queries
3. Always use projections to limit returned fields
4. Always use lean() for read-only queries
5. Always handle cascade operations
6. Always write reversible migrations
7. Never over-index
8. Never use N+1 queries
9. Always run linting after changes
