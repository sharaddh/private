# 40 - Anti-Patterns

## Purpose

This document catalogs common anti-patterns in the KMJ Optical ERP project, including architecture, code, database, security, and performance anti-patterns. Recognizing and avoiding these patterns is essential for maintaining code quality.

## Core Principles

1. **Recognition**: Know what anti-patterns look like.
2. **Prevention**: Avoid anti-patterns before they occur.
3. **Detection**: Catch anti-patterns during code review.
4. **Remediation**: Fix anti-patterns when discovered.
5. **Documentation**: Document anti-patterns for team learning.

## Detailed Rules

### Architecture Anti-Patterns

#### 1. God Object

```typescript
// BAD: God object - class does everything
class ERPSystem {
  async createCustomer(data: any) { /* 50 lines */ }
  async updateCustomer(id: string, data: any) { /* 50 lines */ }
  async deleteCustomer(id: string) { /* 50 lines */ }
  async createOrder(data: any) { /* 50 lines */ }
  async updateOrder(id: string, data: any) { /* 50 lines */ }
  async processPayment(data: any) { /* 50 lines */ }
  async generateReport(type: string) { /* 50 lines */ }
  async sendWhatsApp(phone: string, message: string) { /* 50 lines */ }
  // ... 500 more lines
}

// GOOD: Single responsibility
class CustomerService {
  async create(data: CreateCustomerInput): Promise<Customer> { /* focused */ }
  async update(id: string, data: UpdateCustomerInput): Promise<Customer> { /* focused */ }
  async delete(id: string): Promise<void> { /* focused */ }
}

class OrderService {
  async create(data: CreateOrderInput): Promise<Order> { /* focused */ }
  async update(id: string, data: UpdateOrderInput): Promise<Order> { /* focused */ }
}
```

#### 2. Spaghetti Code

```typescript
// BAD: Spaghetti code - tangled dependencies
// route/customer.ts
router.post('/', async (req, res) => {
  // Direct database access
  const existing = await mongoose.connection.db.collection('customers').findOne({ mobile: req.body.mobile });
  
  // Direct validation
  if (!req.body.name || req.body.name.length < 2) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  
  // Direct business logic
  const customerId = 'CUST-' + Date.now();
  const customer = await mongoose.connection.db.collection('customers').insertOne({
    customerId,
    name: req.body.name,
    mobile: req.body.mobile,
    totalSpent: 0,
    pendingAmount: 0,
  });
  
  // Direct external service call
  await fetch('https://api.whatsapp.com/send', { /* ... */ });
  
  // Direct response formatting
  res.json({ success: true, data: { id: customer.insertedId, name: req.body.name } });
});

// GOOD: Layered architecture
router.post('/', authenticate, branchScope, asyncHandler(async (req, res) => {
  const customer = await customerService.create(req.body, req.branchId);
  res.json(created(customer));
}));
```

#### 3. Tight Coupling

```typescript
// BAD: Tightly coupled components
class OrderService {
  async create(data: any) {
    const order = await Order.create(data);
    
    // Direct dependency on WhatsApp service
    await whatsappService.send(order.customer.mobile, 'Order created');
    
    // Direct dependency on cache service
    await cacheService.invalidate('orders');
    
    // Direct dependency on audit service
    await auditService.log('order_created', order);
    
    return order;
  }
}

// GOOD: Loose coupling via events
class OrderService {
  async create(data: CreateOrderInput): Promise<Order> {
    const order = await Order.create(data);
    domainEvents.emit('order:created', { orderId: order._id, branchId: data.branchId });
    return order;
  }
}

// Event handlers (separate concerns)
domainEvents.on('order:created', async (payload) => {
  await whatsappService.sendOrderNotification(payload);
});

domainEvents.on('order:created', async (payload) => {
  await cacheService.invalidate(`orders:${payload.branchId}:*`);
});

domainEvents.on('order:created', async (payload) => {
  await auditService.log('order_created', payload);
});
```

### Code Anti-Patterns

#### 1. Magic Numbers

```typescript
// BAD: Magic numbers
if (order.status === 5) { /* Delivered */ }
setTimeout(() => { /* ... */ }, 5000);
if (customer.totalSpent > 10000) { /* Premium */ }

// GOOD: Named constants
const ORDER_STATUS_DELIVERED = 'Delivered';
const RECONNECT_DELAY_MS = 5000;
const PREMIUM_CUSTOMER_THRESHOLD = 10000;

if (order.status === ORDER_STATUS_DELIVERED) { /* ... */ }
setTimeout(() => { /* ... */ }, RECONNECT_DELAY_MS);
if (customer.totalSpent > PREMIUM_CUSTOMER_THRESHOLD) { /* ... */ }
```

#### 2. Deep Nesting

```typescript
// BAD: Deep nesting
if (user) {
  if (user.role === 'owner') {
    if (user.branches.length > 0) {
      if (user.branches.includes(branchId)) {
        // Finally, the actual logic!
      }
    }
  }
}

// GOOD: Early returns
if (!user) return;
if (user.role !== 'owner') return;
if (user.branches.length === 0) return;
if (!user.branches.includes(branchId)) return;

// Actual logic (not nested)
```

#### 3. God Function

```typescript
// BAD: God function - does too many things
async function processOrder(orderId: string) {
  // 1. Validate order
  // 2. Check inventory
  // 3. Calculate totals
  // 4. Create bill
  // 5. Process payment
  // 6. Send notification
  // 7. Update dashboard
  // 8. Log audit
  // ... 100 lines
}

// GOOD: Composed functions
async function processOrder(orderId: string): Promise<void> {
  const order = await validateOrder(orderId);
  await checkInventory(order);
  const totals = calculateTotals(order);
  const bill = await createBill(order, totals);
  await processPayment(bill);
  await notifyCustomer(order);
  await updateDashboard();
  await logAudit('order_processed', order);
}
```

#### 4. Stringly-Typed Code

```typescript
// BAD: Stringly-typed
function getStatusColor(status: string) {
  switch (status) {
    case 'Draft': return 'gray';
    case 'Ordered': return 'blue';
    case 'In Lab': return 'yellow';
    case 'Ready': return 'green';
    case 'Delivered': return 'emerald';
    case 'Cancelled': return 'red';
    default: return 'gray';
  }
}

// GOOD: Type-safe
type OrderStatus = 'Draft' | 'Ordered' | 'In Lab' | 'Ready' | 'Delivered' | 'Cancelled';

const STATUS_COLORS: Record<OrderStatus, string> = {
  Draft: 'gray',
  Ordered: 'blue',
  'In Lab': 'yellow',
  Ready: 'green',
  Delivered: 'emerald',
  Cancelled: 'red',
};

function getStatusColor(status: OrderStatus): string {
  return STATUS_COLORS[status];
}
```

### Database Anti-Patterns

#### 1. N+1 Query

```typescript
// BAD: N+1 query
const customers = await Customer.find();
for (const customer of customers) {
  customer.orders = await Order.find({ customerId: customer._id }); // N queries!
}

// GOOD: Batch query
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });
// Group orders by customerId in memory
```

#### 2. Missing Index

```typescript
// BAD: Querying without index
const customers = await Customer.find({ mobile: '9876543210' }); // Full scan!

// GOOD: Add index
customerSchema.index({ mobile: 1 });
const customers = await Customer.find({ mobile: '9876543210' }); // Uses index
```

#### 3. Over-Fetching

```typescript
// BAD: Fetching all fields
const customers = await Customer.find(); // Returns all fields

// GOOD: Projection
const customers = await Customer.find().select('name mobile totalSpent');

// GOOD: Lean queries
const customers = await Customer.find().lean(); // Returns plain objects
```

### Security Anti-Patterns

#### 1. Exposing Internal Details

```typescript
// BAD: Exposing stack traces
catch (error) {
  res.status(500).json({
    success: false,
    message: error.message,
    stack: error.stack, // Never expose!
  });
}

// GOOD: Safe error response
catch (error) {
  console.error('Internal error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
}
```

#### 2. Missing Input Validation

```typescript
// BAD: No validation
router.post('/customers', async (req, res) => {
  const customer = await Customer.create(req.body); // No validation!
});

// GOOD: Zod validation
router.post('/customers', asyncHandler(async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }
  const customer = await Customer.create(parsed.data);
}));
```

#### 3. Hardcoded Secrets

```typescript
// BAD: Hardcoded secrets
const JWT_SECRET = 'super-secret-key';
const MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/kmj';

// GOOD: Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
```

### Performance Anti-Patterns

#### 1. Blocking I/O

```typescript
// BAD: Blocking I/O in route handler
router.post('/orders', asyncHandler(async (req, res) => {
  const order = await Order.create(req.body);
  
  // Blocking!
  await sendWhatsApp(order.customer.mobile, 'Order created');
  await updateDashboard();
  await generatePDF(order);
  
  res.json(created(order));
}));

// GOOD: Non-blocking I/O
router.post('/orders', asyncHandler(async (req, res) => {
  const order = await Order.create(req.body);
  
  // Non-blocking (fire-and-forget)
  sendWhatsApp(order.customer.mobile, 'Order created').catch(console.error);
  updateDashboard().catch(console.error);
  
  res.json(created(order));
}));
```

#### 2. Missing Pagination

```typescript
// BAD: No pagination
const customers = await Customer.find(); // Returns ALL customers

// GOOD: Pagination
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 20;
const skip = (page - 1) * limit;

const [data, total] = await Promise.all([
  Customer.find().skip(skip).limit(limit).lean(),
  Customer.countDocuments(),
]);
```

#### 3. Unoptimized Queries

```typescript
// BAD: Complex query without optimization
const results = await Order.aggregate([
  { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
  { $unwind: '$customer' },
  { $match: { 'customer.name': /john/i } },
]);

// GOOD: Optimized query with indexes
customerSchema.index({ name: 'text' });
const customerIds = await Customer.find({ $text: { $search: 'john' } }).select('_id');
const results = await Order.find({ customerId: { $in: customerIds } });
```

## Detection Checklist

### Architecture
- [ ] No god objects (classes > 300 lines)
- [ ] No spaghetti code (tangled dependencies)
- [ ] No tight coupling (direct service calls)
- [ ] Proper separation of concerns

### Code
- [ ] No magic numbers
- [ ] No deep nesting (> 3 levels)
- [ ] No god functions (> 50 lines)
- [ ] Type-safe code (no `any`)

### Database
- [ ] No N+1 queries
- [ ] All query fields indexed
- [ ] Projections used for read queries
- [ ] Lean queries for read-only operations

### Security
- [ ] No internal details exposed
- [ ] All inputs validated
- [ ] No hardcoded secrets
- [ ] Authentication required

### Performance
- [ ] No blocking I/O
- [ ] Pagination for list queries
- [ ] Optimized queries
- [ ] Caching where appropriate

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Avoiding anti-patterns | Better quality | More upfront effort |
| Detection checklist | Consistent review | Time to check |
| Documentation | Team learning | Maintenance |
| Code review | Catches issues early | Slows development |
| Refactoring | Removes technical debt | Risk of breaking things |

## Cross-References

- **Coding standards**: See `docs/05-coding-standards.md`
- **Architecture**: See `docs/03-clean-architecture.md`
- **Performance**: See `docs/21-performance.md`
- **Security**: See `docs/22-security.md`
- **Code review**: See `docs/30-code-review.md`

## AI Instructions

When reviewing code:
1. Always check for architecture anti-patterns
2. Always check for code anti-patterns
3. Always check for database anti-patterns
4. Always check for security anti-patterns
5. Always check for performance anti-patterns
6. Never introduce anti-patterns in new code
7. Always document anti-patterns found
8. Always suggest remediation
9. Always verify remediation works
10. Always update documentation with new anti-patterns
