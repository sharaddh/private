# 02 - Software Philosophy

## Purpose

This document defines the software engineering philosophy that guides every technical decision in the KMJ Optical ERP project. It explains the "why" behind our technical choices, not just the "what."

## Core Philosophy

### 1. Pragmatism Over Perfection

**Statement**: Ship working software that solves real problems, then iterate.

**Why**: Perfect code that never ships provides zero business value. Working code that solves real problems provides immediate value and can be improved over time.

**Example**:
- The dashboard endpoint executes 23+ queries in parallel. This is not "optimal" from a database perspective, but it provides a fast response time for users. A "perfect" solution might use materialized views or CQRS, but that would take months to implement.

**Tradeoff**:
- **Pragmatic**: Ship fast, fix later
- **Perfect**: Build it right the first time
- **Our approach**: Ship fast for business features, build right for infrastructure

**Anti-pattern**:
```typescript
// BAD: Over-engineering for a feature that might not be needed
class OrderStateMachine {
  private states: Map<string, StateConfig>;
  private transitions: Map<string, TransitionConfig>;
  private validators: Map<string, Validator>;
  private hooks: Map<string, Hook[]>;
  private middleware: Middleware[];
  // 500 lines of infrastructure for a 6-state machine
}
```

**Good pattern**:
```typescript
// GOOD: Simple, clear, maintainable
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Draft': ['Ordered', 'Cancelled'],
  'Ordered': ['In Lab', 'Cancelled'],
  'In Lab': ['Ready', 'Cancelled'],
  'Ready': ['Delivered', 'Cancelled'],
  'Delivered': [],
  'Cancelled': []
};

if (!VALID_TRANSITIONS[order.status]?.includes(newStatus)) {
  throw new AppError(400, `Invalid transition from ${order.status} to ${newStatus}`);
}
```

### 2. Simplicity Over Cleverness

**Statement**: Write code that is easy to understand, not code that is clever.

**Why**: Clever code is hard to debug, hard to maintain, and hard to extend. Simple code is easy to understand, easy to maintain, and easy to extend.

**Example**:
- The `withBranch` proxy pattern is simple to understand: it intercepts property access and routes to the correct database. A cleverer approach might use decorators or metaprogramming, but that would be harder to understand.

**Tradeoff**:
- **Clever**: Shorter code, but harder to understand
- **Simple**: Longer code, but easier to understand
- **Our approach**: Simple code that is easy to understand and maintain

**Anti-pattern**:
```typescript
// BAD: Clever but hard to understand
const withBranch = (model: any) => new Proxy(model, {
  get: (target, prop) => {
    const ctx = getCtx();
    if (ctx?.branchModels) {
      const branchModel = ctx.branchModels[prop as keyof BranchModels];
      return typeof branchModel === 'function' ? branchModel.bind(branchModel) : branchModel;
    }
    return Reflect.get(target, prop);
  }
});
```

**Good pattern**：
```typescript
// GOOD: Clear and understandable
/**
 * Wraps a Mongoose model with branch-aware routing.
 * 
 * When a request has branch context (set by branchScope middleware),
 * all operations on this model will automatically route to the
 * correct branch database. Without branch context, operations
 * fall back to the root database.
 * 
 * @see middleware/branch.ts
 * @see models/db.ts
 */
const withBranch = (model: any) => {
  return new Proxy(model, {
    get: (target, prop) => {
      // Check if we have branch context from the current request
      const ctx = getCtx();
      
      // If we have branch context, route to the branch model
      if (ctx?.branchModels) {
        const branchModel = ctx.branchModels[prop as keyof BranchModels];
        if (typeof branchModel === 'function') {
          return branchModel.bind(branchModel);
        }
        return branchModel;
      }
      
      // Otherwise, fall back to the root model
      return Reflect.get(target, prop);
    }
  });
};
```

### 3. Explicit Over Implicit

**Statement**: Make behavior obvious, not hidden.

**Why**: Hidden behavior is hard to debug and hard to maintain. Explicit behavior is easy to understand and easy to modify.

**Example**:
- The `branchScope` middleware explicitly sets the branch context, making it clear that branch routing is happening. An implicit approach might use decorators or automatic detection.

**Tradeoff**:
- **Implicit**: Less boilerplate, but harder to understand
- **Explicit**: More boilerplate, but easier to understand
- **Our approach**: Explicit code that makes behavior obvious

**Anti-pattern**:
```typescript
// BAD: Implicit behavior
@BranchScoped()
@app.route('/api/customers')
class CustomerController {
  async getCustomers() {
    // Where does this.model come from? How does it know which branch?
    return this.model.find();
  }
}
```

**Good pattern**:
```typescript
// GOOD: Explicit behavior
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  // req.branchModels is explicitly set by branchScope middleware
  // It's clear that we're working with branch-specific data
  const customers = await req.branchModels.Customer.find();
  res.json(success(customers));
}));
```

### 4. Composition Over Inheritance

**Statement**: Build complex behavior from simple, composable parts.

**Why**: Composition is more flexible than inheritance. Composable parts can be rearranged, replaced, and tested independently.

**Example**:
- The middleware chain in Express is a composition pattern: `authenticate`, `branchScope`, `cacheRoute`, `audit` are composed together to create complex behavior from simple parts.

**Tradeoff**:
- **Inheritance**: Less code, but rigid hierarchy
- **Composition**: More code, but flexible arrangement
- **Our approach**: Composition for flexibility and testability

**Anti-pattern**:
```typescript
// BAD: Inheritance hierarchy
class BaseController {
  protected model: any;
  protected authenticate: Middleware;
  protected branchScope: Middleware;
  
  async find() { return this.model.find(); }
  async findById(id: string) { return this.model.findById(id); }
  async create(data: any) { return this.model.create(data); }
  async update(id: string, data: any) { return this.model.findByIdAndUpdate(id, data); }
  async delete(id: string) { return this.model.findByIdAndDelete(id); }
}

class CustomerController extends BaseController {
  // What if CustomerController needs different middleware?
  // What if it needs additional business logic?
  // Inheritance makes this hard to change
}
```

**Good pattern**:
```typescript
// GOOD: Composition
// Each route file composes middleware independently
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  const customers = await req.branchModels.Customer.find();
  res.json(success(customers));
}));

router.post('/', authenticate, branchScope, asyncHandler(async (req, res) => {
  const customer = await req.branchModels.Customer.create(req.body);
  res.json(success(customer));
}));
```

### 5. Convention Over Configuration

**Statement**: Follow established patterns, don't reinvent them.

**Why**: Conventions reduce cognitive load and make code predictable. When everyone follows the same patterns, code is easier to read, understand, and modify.

**Example**:
- The response format `{ success: true, data: ... }` is a convention. Every API endpoint uses this format, making client-side code predictable.

**Tradeoff**:
- **Configuration**: Flexible, but inconsistent
- **Convention**: Rigid, but consistent
- **Our approach**: Convention for consistency, configuration for exceptions

**Anti-pattern**:
```typescript
// BAD: Inconsistent conventions
app.get('/api/customers', (req, res) => {
  res.json({ data: [...], total: 100 }); // One format
});
app.get('/api/orders', (req, res) => {
  res.send(JSON.stringify({ success: true, orders: [...] })); // Different format
});
app.get('/api/bills', (req, res) => {
  res.status(200).json({ ok: true, bills: [...], count: 50 }); // Another format
});
```

**Good pattern**:
```typescript
// GOOD: Consistent conventions
import { success, created, fail, notFound } from '../utils/response';

app.get('/api/customers', asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json(success(customers));
}));

app.post('/api/customers', asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);
  res.json(created(customer));
}));

app.get('/api/customers/:id', asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res.json(notFound('Customer not found'));
  }
  res.json(success(customer));
}));
```

### 6. Incremental Over Big-Bang

**Statement**: Make small, incremental changes instead of large, risky changes.

**Why**: Large changes are hard to review, hard to test, and hard to rollback. Small changes are easy to review, easy to test, and easy to rollback.

**Example**:
- When refactoring the customer controller, extract one method at a time, test each extraction, then move to the next method.

**Tradeoff**:
- **Big-Bang**: Faster to implement, but riskier
- **Incremental**: Slower to implement, but safer
- **Our approach**: Incremental for safety and reviewability

**Anti-pattern**：
```typescript
// BAD: Big-bang refactoring
// Day 1: Rewrite entire customer controller
// Day 2: Rewrite entire order controller
// Day 3: Rewrite entire bill controller
// Day 4: Everything breaks, no idea what went wrong
```

**Good pattern**:
```typescript
// GOOD: Incremental refactoring
// Day 1: Extract CustomerService.find() from controller
// Day 2: Extract CustomerService.create() from controller
// Day 3: Extract CustomerService.update() from controller
// Day 4: Extract CustomerService.delete() from controller
// Each extraction is independently tested and verified
```

### 7. Defensive Over Optimistic

**Statement**: Assume inputs are invalid, assume errors will happen, assume the unexpected.

**Why**: Systems fail in unexpected ways. Defensive programming ensures the system degrades gracefully instead of crashing.

**Example**:
- The `asyncHandler` middleware catches rejected promises and forwards them to the error handler, ensuring unhandled promise rejections don't crash the server.

**Tradeoff**:
- **Optimistic**: Less code, but fragile
- **Defensive**: More code, but robust
- **Our approach**: Defensive for reliability

**Anti-pattern**:
```typescript
// BAD: Optimistic programming
app.post('/api/orders', async (req, res) => {
  const order = await Order.create(req.body); // What if req.body is invalid?
  res.json(order); // What if this throws?
});
```

**Good pattern**:
```typescript
// GOOD: Defensive programming
app.post('/api/orders', authenticate, branchScope, asyncHandler(async (req, res) => {
  // Validate input
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail(parsed.error.issues));
  }
  
  // Create order with validated data
  const order = await req.branchModels.Order.create(parsed.data);
  
  // Invalidate cache
  await invalidateCache('/api/orders');
  await invalidateCache('/api/dashboard');
  
  // Return success response
  res.json(created(order));
}));
```

### 8. Measurable Over Guesswork

**Statement**: Measure performance, don't guess. Measure quality, don't assume.

**Why**: Guesses are often wrong. Measurements provide facts that can be acted upon.

**Example**:
- The cache TTLs (30s, 60s, 120s) are based on measurement of how often data changes, not guesses about what "feels right."

**Tradeoff**：
- **Guesswork**: Fast, but often wrong
- **Measurement**: Slow, but accurate
- **Our approach**: Measure first, then optimize

### 9. Reversible Over Irreversible

**Statement**: Prefer changes that can be easily reversed.

**Why**: Reversible changes reduce risk. If something goes wrong, you can undo it quickly.

**Example**:
- Database migrations should be reversible. If a migration causes problems, it can be rolled back.

**Tradeoff**：
- **Reversible**: More work upfront, but safer
- **Irreversible**: Less work upfront, but riskier
- **Our approach**: Reversible for safety

### 10. Tested Over Untested

**Statement**: Test everything, trust nothing.

**Why**: Untested code is broken code. Tests provide confidence that code works correctly and will continue to work correctly.

**Example**:
- The order status state machine must be tested thoroughly because it involves complex business logic with many edge cases.

**Tradeoff**：
- **Untested**: Faster to write, but risky
- **Tested**: Slower to write, but reliable
- **Our approach**: Tested for reliability

## Philosophy in Practice

### Decision Framework

When making technical decisions, ask:

1. **Is this pragmatic?** - Does it solve a real problem?
2. **Is this simple?** - Is it easy to understand?
3. **Is this explicit?** - Is the behavior obvious?
4. **Is this composable?** - Can it be rearranged?
5. **Is this conventional?** - Does it follow established patterns?
6. **Is this incremental?** - Can it be done in small steps?
7. **Is this defensive?** - Does it handle errors gracefully?
8. **Is this measurable?** - Can we verify it works?
9. **Is this reversible?** - Can it be undone if wrong?
10. **Is this tested?** - Can we verify it continues to work?

### When to Break Principles

Sometimes principles conflict. When this happens:

1. **Security always wins** - Never compromise security for any other principle
2. **Feature preservation always wins** - Never remove features for any other principle
3. **Data integrity always wins** - Never corrupt data for any other principle
4. **Pragmatism wins for business features** - Ship fast for business value
5. **Perfection wins for infrastructure** - Build right for core systems

## Cross-References

- **Engineering principles**: See `docs/01-engineering-principles.md`
- **Coding standards**: See `docs/05-coding-standards.md`
- **Architecture**: See `docs/03-clean-architecture.md`
- **Anti-patterns**: See `docs/40-anti-patterns.md`
- **Refactoring**: See `docs/29-refactoring.md`

## AI Instructions

When working on this project:
1. These philosophies guide every decision
2. When in doubt, choose simplicity over cleverness
3. When in doubt, choose explicit over implicit
4. When in doubt, choose incremental over big-bang
5. When in doubt, choose defensive over optimistic
6. Always document why you chose a particular approach
