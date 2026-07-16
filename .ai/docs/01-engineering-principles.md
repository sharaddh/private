# 01 - Engineering Principles

## Purpose

This document defines the core engineering principles that govern every decision in the KMJ Optical ERP project. These principles are not suggestions - they are rules that every engineer and AI agent must follow without exception.

## Core Principles

### 1. Business Logic is Sacred

**Statement**: Never rewrite business behavior unless explicitly instructed.

**Why**: Business logic represents years of accumulated knowledge about how the optical retail business works. Every field, every calculation, every validation has a reason. Rewriting it without understanding the reason will break things.

**Example**:
- The `pendingAmount` calculation on bills: `pendingAmount = totalAmount - advancePaid`. This seems simple, but it accounts for partial payments, discounts, and taxes in a specific order. Rewriting this could break payment tracking.

**Anti-pattern**:
```typescript
// BAD: Rewriting business logic for "cleaner" code
const calculatePending = (bill: Bill) => bill.totalAmount - bill.payments.reduce((sum, p) => sum + p.amount, 0);
// This ignores advancePaid, discount, and tax calculations that happen elsewhere
```

**Good pattern**:
```typescript
// GOOD: Preserving existing business logic
// The existing calculation in routes/bills.ts handles all edge cases
// Only modify if explicitly instructed and with full understanding
```

### 2. Feature Preservation is Non-Negotiable

**Statement**: Every refactor must prove feature parity.

**Why**: Users depend on every feature. Removing or changing a feature, even if it seems unused, will break someone's workflow.

**Example**:
- The `forwardedCount` field on orders supports partial quantity advancement. This is a niche feature but critical for shops that process orders in batches.

**Checklist for feature preservation**:
1. All existing API endpoints return same data
2. All existing database queries return same results
3. All existing UI pages render correctly
4. All existing permissions are enforced
5. All existing audit logs are generated
6. All existing reports show correct data
7. All existing workflows complete successfully

### 3. Architecture First

**Statement**: Design before implementation.

**Why**: Poor architecture creates technical debt that compounds over time. A well-designed system is easier to maintain, extend, and debug.

**Example**:
- The multi-tenant branch architecture using `AsyncLocalStorage` and `Proxy` was a deliberate architectural decision. It allows transparent data isolation without changing business logic code.

**Anti-pattern**:
```typescript
// BAD: Jumping straight to implementation without design
app.get('/api/customers', async (req, res) => {
  // 200 lines of business logic, database queries, and response formatting
  // No separation of concerns, no reusability, no testability
});
```

**Good pattern**:
```typescript
// GOOD: Design first, then implement
// Route: routes/customers.ts - handles HTTP concerns
// Controller: controllers/customerController.ts - handles business logic
// Model: models/customer.ts - handles data access
// Each layer is independently testable and reusable
```

### 4. Security is Not Optional

**Statement**: Never compromise security for convenience.

**Why**: A security breach can destroy the business. Customer data, financial data, and business data must be protected.

**Example**:
- The JWT authentication system, while having known issues (shared secret for access/refresh tokens), provides baseline security. Never remove or weaken it without a replacement.

**Anti-pattern**:
```typescript
// BAD: Skipping authentication for "convenience"
app.get('/api/customers', async (req, res) => {
  // No authentication check - anyone can access customer data
});
```

**Good pattern**:
```typescript
// GOOD: Always authenticate
app.get('/api/customers', authenticate, branchScope, async (req, res) => {
  // Authentication and branch scoping applied
});
```

### 5. Error Handling is Not Optional

**Statement**: Every error must be handled gracefully.

**Why**: Unhandled errors crash the server, lose data, and frustrate users. Proper error handling ensures the system remains stable even when things go wrong.

**Example**:
- The `asyncHandler` middleware wraps all async route handlers to catch rejected promises and forward them to the error handler.

**Anti-pattern**:
```typescript
// BAD: Ignoring errors
app.get('/api/customers', async (req, res) => {
  const customers = await Customer.find(); // What if this throws?
  res.json(customers);
});
```

**Good pattern**:
```typescript
// GOOD: Proper error handling
app.get('/api/customers', asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json(success(customers));
}));
```

### 6. Validation is Not Optional

**Statement**: Every input must be validated.

**Why**: Invalid data causes crashes, data corruption, and security vulnerabilities. Validation is the first line of defense.

**Example**:
- The Zod schemas in route files validate all incoming data before processing.

**Anti-pattern**:
```typescript
// BAD: No validation
app.post('/api/customers', async (req, res) => {
  const customer = await Customer.create(req.body); // What if req.body has invalid data?
});
```

**Good pattern**:
```typescript
// GOOD: Proper validation
app.post('/api/customers', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues });
  }
  const customer = await Customer.create(parsed.data);
});
```

### 7. Documentation is Not Optional

**Statement**: Every decision must be documented.

**Why**: Undocumented decisions are lost knowledge. Future engineers (including AI agents) will not understand why things were done a certain way.

**Example**:
- This knowledge base itself is an example of documentation. Every pattern, every convention, every decision is documented here.

**Anti-pattern**:
```typescript
// BAD: No documentation for complex logic
const calculateOrderTotal = (order: Order) => {
  return order.framePrice + order.lensPrice + order.coatingPrice + 
    (order.accessories?.reduce((sum, acc) => sum + (inventoryMap.get(acc)?.sellingPrice || 0), 0) || 0);
};
```

**Good pattern**:
```typescript
// GOOD: Document complex logic
/**
 * Calculates the total order amount.
 * 
 * Business rule: Total = Frame + Lens + Coating + Accessories
 * - Accessory prices are looked up from inventory by SKU
 * - If an accessory SKU is not found in inventory, its price is 0
 * - This matches the behavior in the main ERP client
 * 
 * @see knowledge/business-domains.md#order-pricing
 * @see routes/orders.ts#createOrder
 */
const calculateOrderTotal = (order: Order) => {
  return order.framePrice + order.lensPrice + order.coatingPrice + 
    (order.accessories?.reduce((sum, acc) => sum + (inventoryMap.get(acc)?.sellingPrice || 0), 0) || 0);
};
```

### 8. Testing is Not Optional

**Statement**: Every change must be tested.

**Why**: Untested code is broken code. Tests prevent regressions and provide documentation of expected behavior.

**Example**:
- The order status state machine has specific valid transitions. Tests ensure these transitions are enforced.

**Anti-pattern**:
```typescript
// BAD: No tests for critical business logic
// The order status transition logic is complex but has no tests
// This means regressions can slip through silently
```

**Good pattern**:
```typescript
// GOOD: Comprehensive tests
describe('Order Status Transitions', () => {
  it('should allow Draft → Ordered', async () => {
    const order = await createOrder({ status: 'Draft' });
    const updated = await updateStatus(order._id, 'Ordered');
    expect(updated.status).toBe('Ordered');
  });

  it('should reject Draft → Delivered', async () => {
    const order = await createOrder({ status: 'Draft' });
    await expect(updateStatus(order._id, 'Delivered')).rejects.toThrow();
  });
});
```

### 9. Performance is Not Optional

**Statement**: Every change must consider performance.

**Why**: Slow systems frustrate users and cost money. Performance should be considered from the start, not added later.

**Example**:
- The dashboard endpoint executes 23+ queries in parallel using `Promise.all()`. This is a performance decision - parallel execution is faster than sequential.

**Anti-pattern**:
```typescript
// BAD: N+1 query problem
const customers = await Customer.find();
for (const customer of customers) {
  customer.orders = await Order.find({ customerId: customer._id }); // N queries!
}
```

**Good pattern**:
```typescript
// GOOD: Batch query
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });
// Then group orders by customerId in memory
```

### 10. Maintainability is Not Optional

**Statement**: Every change must be maintainable.

**Why**: Code is read 10x more than it is written. Code that is hard to maintain will accumulate technical debt and eventually become a liability.

**Example**:
- The consistent response format `{ success: true, data: ... }` makes all API responses predictable and easy to handle.

**Anti-pattern**:
```typescript
// BAD: Inconsistent response format
app.get('/api/customers', (req, res) => {
  res.json({ customers: [...], total: 100 }); // Different format
});
app.get('/api/orders', (req, res) => {
  res.json({ success: true, data: [...], count: 100 }); // Different format
});
```

**Good pattern**:
```typescript
// GOOD: Consistent response format
app.get('/api/customers', (req, res) => {
  res.json(success({ customers: [...], total: 100 })); // Same format
});
app.get('/api/orders', (req, res) => {
  res.json(success({ orders: [...], total: 100 })); // Same format
});
```

## Principle Hierarchy

When principles conflict, follow this priority:

1. **Security** (highest) - Never compromise security
2. **Feature Preservation** - Never remove features
3. **Data Integrity** - Never corrupt data
4. **Business Logic** - Never rewrite without instruction
5. **Error Handling** - Always handle errors
6. **Validation** - Always validate inputs
7. **Testing** - Always test changes
8. **Documentation** - Always document decisions
9. **Performance** - Always consider performance
10. **Maintainability** (lowest) - Always write maintainable code

## Cross-References

- **Detailed coding standards**: See `docs/05-coding-standards.md`
- **Feature preservation rules**: See `docs/28-feature-preservation.md`
- **Security rules**: See `docs/22-security.md`
- **Error handling rules**: See `docs/19-error-handling.md`
- **Testing rules**: See `docs/23-testing.md`
- **Performance rules**: See `docs/21-performance.md`

## AI Instructions

When working on this project:
1. These principles are not suggestions - they are rules
2. When principles conflict, follow the hierarchy above
3. When unsure, ask the Chief Architect (see AGENTS.md)
4. Always document why you made a decision
5. Always verify feature preservation after any change
