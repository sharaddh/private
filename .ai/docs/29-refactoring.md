# 29 - Refactoring

## Purpose

This document defines refactoring guidelines for the KMJ Optical ERP system. Refactoring must be safe, incremental, and verifiable. Every refactoring must prove feature parity before completion.

## Core Principles

1. **Small increments**: Never refactor more than 3 files at once.
2. **Test-driven**: Always have tests before and after refactoring.
3. **Feature preservation**: Every refactoring must prove all features still work.
4. **Reversible**: Every refactoring step must be reversible.
5. **Documented**: Every refactoring must explain why it was done.

## Detailed Rules

### When to Refactor

**Refactor when**:
1. Code is duplicated across 3+ locations
2. Function exceeds 50 lines
3. File exceeds 500 lines
4. Cyclomatic complexity exceeds 10
5. Code has no tests
6. Code violates established patterns
7. Performance bottleneck is identified
8. Technical debt is blocking feature development

**Do NOT refactor when**:
1. Feature is actively being developed by another engineer
2. Bug fix is in progress
3. Production incident is active
4. Refactoring is not motivated by a real problem
5. Refactoring would change API contracts without versioning

### How to Refactor Safely

#### Step 1: Understand the Code

Before refactoring, understand:
1. What the code does (read it completely)
2. Why it was written this way (check git history)
3. What depends on it (check imports/exports)
4. What tests cover it (check test files)
5. What documentation exists (check docs)

```typescript
// Step 1 checklist
// [ ] Read all code in the file
// [ ] Check git blame for context
// [ ] Find all importers of this file
// [ ] Find all tests covering this code
// [ ] Read related documentation
```

#### Step 2: Write Tests

Before changing code, ensure test coverage:

```typescript
// Step 2: Write tests before refactoring
describe('CustomerService', () => {
  it('should create customer with valid data', async () => {
    const customer = await customerService.create({
      name: 'Test Customer',
      mobile: '9876543210',
    });
    expect(customer.name).toBe('Test Customer');
    expect(customer.mobile).toBe('9876543210');
  });

  it('should reject duplicate mobile', async () => {
    await customerService.create({ name: 'First', mobile: '9876543210' });
    await expect(
      customerService.create({ name: 'Second', mobile: '9876543210' })
    ).rejects.toThrow('Customer with this mobile already exists');
  });
});
```

#### Step 3: Make Small Changes

Refactor in small, testable increments:

```typescript
// Step 3: Small incremental changes
// Change 1: Extract validation function
function validateCustomerInput(data: unknown): CreateCustomerInput {
  const parsed = createCustomerSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid customer data', parsed.error.issues);
  }
  return parsed.data;
}

// Change 2: Extract duplicate check
async function checkCustomerDuplicate(mobile: string): Promise<void> {
  const existing = await Customer.findOne({ mobile });
  if (existing) {
    throw new AppError(409, 'Customer with this mobile already exists');
  }
}

// Change 3: Use extracted functions
async function createCustomer(data: unknown): Promise<Customer> {
  const validated = validateCustomerInput(data);
  await checkCustomerDuplicate(validated.mobile);
  return Customer.create(validated);
}
```

#### Step 4: Run Tests

After each change, run all tests:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "CustomerService"

# Run with coverage
npm test -- --coverage
```

#### Step 5: Verify Feature Parity

Before completing refactoring, verify all features still work:

```typescript
// Step 5: Feature parity checklist
// [ ] All API endpoints return same responses
// [ ] All database queries return same results
// [ ] All UI pages render correctly
// [ ] All permissions are enforced
// [ ] All audit logs are generated
// [ ] All reports show correct data
// [ ] All WhatsApp notifications work
// [ ] All scheduled tasks work
```

#### Step 6: Update Documentation

After refactoring, update all affected documentation:

```markdown
## What Changed
- Extracted `validateCustomerInput` from `createCustomer`
- Extracted `checkCustomerDuplicate` from `createCustomer`
- `createCustomer` now uses extracted functions

## Why Changed
- Reduce function complexity
- Improve testability
- Enable reuse of validation logic

## Feature Preservation
- All existing functionality preserved
- All API contracts unchanged
- All database operations unchanged
```

### Extracting Services

When extracting services, follow these patterns:

```typescript
// BEFORE: Business logic in route handler
router.post('/customers', authenticate, branchScope, asyncHandler(async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }

  const existing = await Customer.findOne({ mobile: parsed.data.mobile });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Customer already exists' });
  }

  const customer = await Customer.create(parsed.data);
  res.json(created(customer));
}));

// AFTER: Business logic in service
class CustomerService {
  async create(data: unknown, branchId: string): Promise<Customer> {
    const validated = this.validateInput(data);
    await this.checkDuplicate(validated.mobile, branchId);
    return this.customerModel.create(validated);
  }
}

router.post('/customers', authenticate, branchScope, asyncHandler(async (req, res) => {
  const customer = await customerService.create(req.body, req.branchId);
  res.json(created(customer));
}));
```

### Extracting Controllers

When extracting controllers, follow these patterns:

```typescript
// BEFORE: Mixed concerns in route
router.get('/customers', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: new RegExp(search as string, 'i') },
      { mobile: new RegExp(search as string, 'i') },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Customer.countDocuments(filter),
  ]);
  res.json(success({ data, total, page: Number(page), limit: Number(limit) }));
}));

// AFTER: Controller handles HTTP, service handles business logic
class CustomerController {
  async list(req: Request, res: Response) {
    const result = await customerService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string,
      branchId: req.branchId,
    });
    res.json(success(result));
  }
}
```

### Preserving Features During Refactoring

During refactoring, always preserve:

1. **All API endpoints** - Same URLs, same methods, same response shapes
2. **All database operations** - Same queries, same results, same performance
3. **All business rules** - Same validations, same calculations, same transitions
4. **All permissions** - Same access controls, same role checks
5. **All audit logs** - Same events, same data, same timing
6. **All WhatsApp messages** - Same triggers, same content, same recipients
7. **All reports** - Same data, same calculations, same format
8. **All scheduled tasks** - Same frequency, same logic, same output

```typescript
// GOOD: Feature preservation during refactoring
// Step 1: Add new service alongside old code
class NewCustomerService {
  async create(data: unknown): Promise<Customer> {
    // New implementation
  }
}

// Step 2: Update route to use new service
router.post('/customers', asyncHandler(async (req, res) => {
  const customer = await newCustomerService.create(req.body);
  res.json(created(customer));
}));

// Step 3: Verify all features still work
// [ ] Customer creation works
// [ ] Validation works
// [ ] Duplicate check works
// [ ] Audit log is generated
// [ ] WhatsApp notification is sent
// [ ] Dashboard is updated

// Step 4: Remove old code after verification
```

## Bad Examples

```typescript
// BAD: Large, unfocused refactoring
// This refactoring touches 15 files and changes API contracts
async function refactorEverything() {
  // Changed response shape from { data: [] } to { customers: [] }
  // Changed URL from /api/customers to /api/v2/customers
  // Changed validation from Zod to manual
  // Changed error format from { success: false, message } to { error: string }
  // All frontend code breaks!
}
```

```typescript
// BAD: Refactoring without tests
// This refactoring has no test coverage
function refactorPaymentCalculation(bill: Bill) {
  // Changed calculation logic
  // No tests to verify correctness
  // May break payment processing!
}
```

```typescript
// BAD: Refactoring while feature is in development
// Another engineer is adding a feature to this code
// Refactoring conflicts with their work
function refactorCustomerService() {
  // Changes the interface that the feature branch depends on
  // Breaks the other engineer's work
}
```

## Good Examples

```typescript
// GOOD: Incremental, safe refactoring
// Phase 1: Extract validation (1 file change)
// - Add `validateCustomerInput` function
// - Add tests for validation
// - Verify all features work

// Phase 2: Extract duplicate check (1 file change)
// - Add `checkCustomerDuplicate` function
// - Add tests for duplicate check
// - Verify all features work

// Phase 3: Extract service (2 file changes)
// - Create `CustomerService` class
// - Update route to use service
// - Add tests for service
// - Verify all features work

// Phase 4: Update documentation (1 file change)
// - Update API documentation
// - Update architecture documentation
// - Verify documentation is accurate
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Small incremental changes | Easy to verify, easy to revert | More commits, more context switching |
| Test-driven refactoring | Confidence in changes | Time to write tests |
| Feature parity verification | Catches regressions | Time-consuming |
| Documentation updates | Keeps docs accurate | Additional work |
| Service extraction | Better separation of concerns | More files to maintain |

## Cross-References

- **Feature preservation**: See `docs/28-feature-preservation.md`
- **Code review**: See `docs/30-code-review.md`
- **Testing**: See `docs/20-testing.md`
- **Architecture**: See `docs/03-clean-architecture.md`
- **Coding standards**: See `docs/05-coding-standards.md`

## AI Instructions

When refactoring code:
1. Always understand the code before changing it
2. Always write tests before refactoring
3. Always make small, incremental changes
4. Always run tests after each change
5. Always verify feature parity before completing
6. Always update documentation after refactoring
7. Never refactor more than 3 files at once
8. Never change API contracts without versioning
9. Never refactor while a feature is in development
10. Always document why the refactoring was done
