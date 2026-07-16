# 44 - AI Review Process

## Purpose

This document defines the AI review process for the KMJ Optical ERP project, including self-review checklist, common AI mistakes, quality gates, and verification steps. AI-generated code must undergo rigorous review before being accepted.

## Core Principles

1. **Self-review first**: AI agents must review their own code before submission.
2. **Quality gates**: Code must pass all quality gates before merging.
3. **Verification steps**: Every change must be verified through testing.
4. **Documentation**: Every change must be documented.
5. **Feature preservation**: Every change must preserve all existing features.

## Detailed Rules

### Self-Review Checklist

Before submitting any code change, AI agents must verify:

#### Code Quality

- [ ] No `any` types used
- [ ] All functions have return types
- [ ] All inputs are validated
- [ ] All errors are handled
- [ ] All edge cases handled
- [ ] No magic numbers (use constants)
- [ ] No deep nesting (max 3 levels)
- [ ] Functions are small and focused (< 50 lines)

#### Naming Conventions

- [ ] Variables use camelCase
- [ ] Functions use camelCase
- [ ] Classes use PascalCase
- [ ] Constants use UPPER_SNAKE_CASE
- [ ] Interfaces use PascalCase with `I` prefix (optional)
- [ ] Files use kebab-case
- [ ] Descriptive names used

#### Coding Standards

- [ ] TypeScript used (no plain JavaScript)
- [ ] Named exports used for utilities
- [ ] Default exports used for React components
- [ ] Import type used for type-only imports
- [ ] Imports grouped correctly
- [ ] async/await used (no .then chains)
- [ ] const used by default

#### Backend Standards

- [ ] asyncHandler used for async route handlers
- [ ] Zod validation used for inputs
- [ ] Consistent response format used
- [ ] AppError used for business errors
- [ ] Authentication required for protected endpoints
- [ ] Authorization enforced
- [ ] Branch scope applied
- [ ] Caching where appropriate

#### Frontend Standards

- [ ] Components are reusable
- [ ] State management appropriate
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Forms validated
- [ ] Accessibility features included
- [ ] Responsive design used
- [ ] Dark mode supported

#### Database Standards

- [ ] Indexes for query fields
- [ ] No N+1 queries
- [ ] Projections used
- [ ] Lean queries for read-only
- [ ] Pagination implemented
- [ ] Migrations written for schema changes

#### Security Standards

- [ ] Authentication enforced
- [ ] Authorization enforced
- [ ] Inputs validated and sanitized
- [ ] No sensitive data in logs
- [ ] No sensitive data in errors
- [ ] CORS properly configured
- [ ] Rate limiting applied

#### Performance Standards

- [ ] Database queries optimized
- [ ] Caching used appropriately
- [ ] No blocking operations
- [ ] No memory leaks
- [ ] Response times acceptable

#### Feature Preservation

- [ ] All existing features preserved
- [ ] All API contracts maintained
- [ ] All database operations preserved
- [ ] All business rules maintained
- [ ] All permissions enforced
- [ ] All audit logs generated
- [ ] All WhatsApp notifications work

#### Documentation

- [ ] Complex logic documented
- [ ] API endpoints documented
- [ ] Business rules documented
- [ ] README updated if needed
- [ ] CHANGELOG updated if needed

### Common AI Mistakes

#### 1. Removing Features

```typescript
// BAD: AI removes "unused" field
// Before:
interface ICustomer {
  name: string;
  mobile: string;
  alternateMobile?: string; // "Nobody uses this"
}

// After (WRONG):
interface ICustomer {
  name: string;
  mobile: string;
}

// CORRECT: Preserve all fields
interface ICustomer {
  name: string;
  mobile: string;
  alternateMobile?: string;
}
```

#### 2. Simplifying Business Logic

```typescript
// BAD: AI simplifies payment validation
// Before:
if (amount > bill.totalAmount - bill.advancePaid) {
  throw new AppError(400, 'Amount exceeds pending amount');
}

// After (WRONG - removed validation):
await Bill.findByIdAndUpdate(billId, { $inc: { advancePaid: amount } });

// CORRECT: Preserve all validation
if (amount > bill.totalAmount - bill.advancePaid) {
  throw new AppError(400, 'Amount exceeds pending amount');
}
await Bill.findByIdAndUpdate(billId, { $inc: { advancePaid: amount, pendingAmount: -amount } });
```

#### 3. Changing API Contracts

```typescript
// BAD: AI changes response shape
// Before:
res.json({ success: true, data: customers });

// After (WRONG):
res.json({ success: true, customers: customers }); // Frontend breaks!

// CORRECT: Preserve response shape
res.json({ success: true, data: customers });
```

#### 4. Missing Error Handling

```typescript
// BAD: AI omits error handling
router.get('/customers', asyncHandler(async (req, res) => {
  const customers = await Customer.find(); // No try/catch!
  res.json(success(customers));
}));

// CORRECT: Proper error handling
router.get('/customers', asyncHandler(async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(success(customers));
  } catch (error) {
    throw new AppError(500, 'Failed to fetch customers');
  }
}));
```

#### 5. Introducing Anti-Patterns

```typescript
// BAD: AI introduces anti-patterns
async function processOrder(orderId: string) {
  // God function - does too many things
  // 100+ lines of code
}

// CORRECT: Extract into focused functions
async function processOrder(orderId: string): Promise<void> {
  const order = await validateOrder(orderId);
  await checkInventory(order);
  const totals = calculateTotals(order);
  const bill = await createBill(order, totals);
  await processPayment(bill);
  await sendNotification(order);
}
```

### Quality Gates

#### Gate 1: Code Review

Before merging, code must pass:

- [ ] Self-review checklist completed
- [ ] Peer review completed
- [ ] No blocking issues found
- [ ] All comments addressed

#### Gate 2: Automated Testing

Before merging, code must pass:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage meets minimum (80%)
- [ ] No test failures

#### Gate 3: Static Analysis

Before merging, code must pass:

- [ ] TypeScript compilation succeeds
- [ ] ESLint passes with no errors
- [ ] Prettier formatting correct
- [ ] No security vulnerabilities

#### Gate 4: Feature Verification

Before merging, code must verify:

- [ ] All existing features work
- [ ] All API endpoints work
- [ ] All UI pages work
- [ ] All permissions work
- [ ] All audit logs work
- [ ] All WhatsApp notifications work

#### Gate 5: Documentation

Before merging, code must include:

- [ ] Code documentation complete
- [ ] API documentation updated
- [ ] Architecture documentation updated
- [ ] README updated (if needed)
- [ ] CHANGELOG updated (if needed)

### Verification Steps

#### Step 1: Run All Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "CustomerService"

# Run with coverage
npm test -- --coverage
```

#### Step 2: Run Linting

```bash
# Run ESLint
npm run lint

# Run Prettier
npm run format
```

#### Step 3: Run Type Checking

```bash
# Run TypeScript compiler
npm run typecheck
```

#### Step 4: Manual Verification

```markdown
## Manual Verification Checklist

### Backend
- [ ] API endpoints work correctly
- [ ] Error handling works correctly
- [ ] Authentication works correctly
- [ ] Authorization works correctly
- [ ] Caching works correctly

### Frontend
- [ ] UI renders correctly
- [ ] Forms work correctly
- [ ] Navigation works correctly
- [ ] Loading states work correctly
- [ ] Error states work correctly
- [ ] Dark mode works correctly
- [ ] Mobile responsive works correctly
```

## Bad Examples

```markdown
# BAD: Skipping self-review
"I've written the code, let me submit it now"

# BAD: Not running tests
"I'm sure the tests will pass"

# BAD: Not verifying feature preservation
"Adding a new feature shouldn't break anything"

# BAD: Not documenting changes
"Code speaks for itself"
```

## Good Examples

```markdown
# GOOD: Thorough self-review
## Self-Review Completed

### Code Quality
- [x] No `any` types used
- [x] All functions have return types
- [x] All inputs validated with Zod
- [x] All errors handled with AppError

### Feature Preservation
- [x] All existing API endpoints preserved
- [x] All existing database operations preserved
- [x] All existing business rules preserved
- [x] All existing permissions preserved

### Testing
- [x] All existing tests pass
- [x] New tests written for new code
- [x] Test coverage at 85%

### Documentation
- [x] API endpoints documented
- [x] Business rules documented
- [x] README updated
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Self-review | Catches issues early | More time per change |
| Quality gates | Consistent quality | More process overhead |
| Verification steps | Confidence in changes | More testing time |
| Documentation | Maintainability | More documentation |
| Feature preservation | No regressions | More verification |

## Cross-References

- **AI workflow**: See `docs/43-ai-workflow.md`
- **AI team roles**: See `docs/45-ai-team.md`
- **Code review**: See `docs/30-code-review.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`
- **Checklists**: See `docs/41-checklists.md`

## AI Instructions

When reviewing AI-generated code:
1. Always complete self-review checklist
2. Always run all tests
3. Always run linting
4. Always run type checking
5. Always verify feature preservation
6. Always document changes
7. Never skip quality gates
8. Never assume tests pass
9. Always address review comments
10. Always verify manually
