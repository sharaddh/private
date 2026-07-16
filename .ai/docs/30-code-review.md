# 30 - Code Review

## Purpose

This document defines the code review process for the KMJ Optical ERP system. Every code change must be reviewed before merging. Code review ensures quality, consistency, security, and feature preservation.

## Core Principles

1. **Every change needs review**: No code merges without review approval.
2. **Constructive feedback**: Reviews should be helpful, not hostile.
3. **Feature preservation**: Reviews must verify no features are removed.
4. **Security first**: Security concerns override all other feedback.
5. **Knowledge sharing**: Reviews are learning opportunities for both reviewer and author.

## Detailed Rules

### Review Checklist

Every review must verify:

#### Code Quality
- [ ] Code follows coding standards (docs/05-coding-standards.md)
- [ ] Code follows naming conventions (docs/06-naming-conventions.md)
- [ ] No `any` types used
- [ ] All functions have return types
- [ ] All inputs are validated
- [ ] All errors are handled
- [ ] No deep nesting (max 3 levels)
- [ ] No magic numbers (use constants)
- [ ] Functions are small and focused (< 50 lines)

#### Architecture
- [ ] Code follows existing patterns
- [ ] Separation of concerns maintained
- [ ] No business logic in routes
- [ ] No HTTP concerns in services
- [ ] No database concerns in controllers
- [ ] Dependencies flow inward (routes → controllers → services → models)

#### Security
- [ ] Authentication required for protected endpoints
- [ ] Authorization enforced (role checks, branch checks)
- [ ] Inputs validated and sanitized
- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages
- [ ] Rate limiting applied where needed
- [ ] CORS properly configured

#### Performance
- [ ] Database queries use indexes
- [ ] No N+1 queries
- [ ] Pagination used for lists
- [ ] Projections used to limit fields
- [ ] Lean queries for read-only operations
- [ ] Caching used where appropriate

#### Feature Preservation
- [ ] All existing features preserved
- [ ] All API contracts maintained
- [ ] All database operations preserved
- [ ] All business rules maintained
- [ ] All permissions enforced
- [ ] All audit logs generated
- [ ] All WhatsApp notifications work

#### Testing
- [ ] Tests written for new code
- [ ] Tests cover edge cases
- [ ] Tests cover error scenarios
- [ ] Tests are maintainable

#### Documentation
- [ ] Complex logic documented
- [ ] API endpoints documented
- [ ] Business rules documented
- [ ] README updated if needed

### Common Issues to Check

#### Backend Issues

```typescript
// ISSUE: Missing asyncHandler
router.get('/customers', async (req, res) => {  // Unhandled rejection!
  const customers = await Customer.find();
  res.json(customers);
});

// CORRECT
router.get('/customers', asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json(success(customers));
}));
```

```typescript
// ISSUE: Missing input validation
router.post('/customers', async (req, res) => {
  const customer = await Customer.create(req.body); // No validation!
});

// CORRECT
router.post('/customers', asyncHandler(async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }
  const customer = await Customer.create(parsed.data);
  res.json(created(customer));
}));
```

```typescript
// ISSUE: Missing error handling
async function getCustomer(id: string) {
  const customer = await Customer.findById(id); // What if this throws?
  return customer;
}

// CORRECT
async function getCustomer(id: string): Promise<Customer> {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }
  return customer;
}
```

#### Frontend Issues

```tsx
// ISSUE: No loading state
function CustomerList() {
  const [customers, setCustomers] = useState([]);
  useEffect(() => {
    fetchCustomers().then(setCustomers);
  }, []);
  return <div>{customers.map(c => <div key={c._id}>{c.name}</div>)}</div>;
}

// CORRECT
function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{customers.map(c => <div key={c._id}>{c.name}</div>)}</div>;
}
```

```tsx
// ISSUE: No key prop
function CustomerList({ customers }) {
  return <div>{customers.map(c => <CustomerCard customer={c} />)}</div>;
}

// CORRECT
function CustomerList({ customers }) {
  return <div>{customers.map(c => <CustomerCard key={c._id} customer={c} />)}</div>;
}
```

#### Database Issues

```typescript
// ISSUE: N+1 query
const customers = await Customer.find();
for (const customer of customers) {
  customer.orders = await Order.find({ customerId: customer._id }); // N+1!
}

// CORRECT
const customers = await Customer.find();
const customerIds = customers.map(c => c._id);
const orders = await Order.find({ customerId: { $in: customerIds } });
```

```typescript
// ISSUE: Missing index
// Querying by field without index
const customers = await Customer.find({ mobile: '9876543210' });

// CORRECT: Add index to schema
customerSchema.index({ mobile: 1 });
```

### Security Review

Security review must verify:

1. **Authentication**: All protected endpoints require valid JWT
2. **Authorization**: All endpoints enforce role-based access
3. **Input validation**: All inputs validated with Zod
4. **SQL injection**: No raw queries (Mongoose handles this)
5. **XSS**: No unescaped user input in HTML
6. **CSRF**: CSRF protection enabled for state-changing operations
7. **Rate limiting**: Rate limiting applied to all endpoints
8. **Sensitive data**: No passwords, tokens, or secrets in logs
9. **HTTPS**: All production traffic over HTTPS
10. **CORS**: CORS properly configured

```typescript
// SECURITY ISSUE: Exposing internal details
catch (error) {
  res.status(500).json({
    success: false,
    message: error.message,
    stack: error.stack, // Never expose stack traces!
    db: process.env.MONGODB_URI, // Never expose connection strings!
  });
}

// CORRECT
catch (error) {
  console.error('Internal error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
}
```

### Performance Review

Performance review must verify:

1. **Database queries**: All queries use appropriate indexes
2. **Query complexity**: No unnecessary aggregations
3. **Data loading**: No over-fetching or under-fetching
4. **Caching**: Appropriate caching for frequently accessed data
5. **Pagination**: All list endpoints support pagination
6. **Lean queries**: Read-only operations use `.lean()`
7. **Projections**: Response fields limited to what's needed
8. **Connection pooling**: Database connections properly pooled
9. **Memory usage**: No memory leaks (unbounded arrays, event listeners)
10. **Response size**: API responses not excessively large

### Architecture Review

Architecture review must verify:

1. **Separation of concerns**: Routes handle HTTP, services handle business logic
2. **Dependency direction**: Dependencies flow inward (routes → controllers → services → models)
3. **Error handling**: Consistent error handling throughout
4. **Validation**: Input validation at the boundary (routes)
5. **Business rules**: Business rules in services, not routes
6. **Data access**: Data access in models/repositories, not controllers
7. **External services**: External service calls in services, not controllers
8. **Event handling**: Events for decoupled communication
9. **Caching**: Caching at appropriate layers
10. **Logging**: Consistent logging throughout

### Reviewer Responsibilities

**Reviewers must**:
1. Review within 24 hours of request
2. Provide constructive, specific feedback
3. Verify feature preservation
4. Verify security considerations
5. Verify performance implications
6. Verify documentation updates
7. Approve only when all criteria are met

**Reviewers must NOT**:
1. Block on stylistic preferences (use linter)
2. Block on personal preferences (follow project conventions)
3. Review without reading the code
4. Approve without verifying criteria
5. Request changes without explanation

### Author Responsibilities

**Authors must**:
1. Self-review before requesting review
2. Provide clear PR description
3. Include test coverage
4. Update documentation
5. Respond to feedback constructively
6. Make requested changes promptly

## Bad Examples

```typescript
// BAD: Review that only says "looks good"
// This review provides no value
LGTM 👍
```

```typescript
// BAD: Review without context
// This review doesn't explain why
"Change this."

// GOOD: Review with context
"The `Customer.create()` call here bypasses validation. We should use
`customerService.create()` which includes validation and duplicate checks.
See docs/05-coding-standards.md#validation-standards."
```

## Good Examples

```typescript
// GOOD: Thorough review
/**
 * Review Comments:
 *
 * 1. SECURITY: Line 45 - `req.body` is passed directly to `Customer.create()`
 *    without validation. Use Zod schema validation first.
 *    See: docs/05-coding-standards.md#validation-standards
 *
 * 2. PERFORMANCE: Line 67 - `Customer.find()` without pagination will be
 *    slow with large datasets. Add pagination support.
 *    See: docs/21-performance.md#pagination
 *
 * 3. FEATURE PRESERVATION: The original code had a duplicate mobile check
 *    that was removed. This must be preserved.
 *    See: docs/28-feature-preservation.md
 *
 * 4. ERROR HANDLING: Line 89 - Missing try/catch around async operation.
 *    Use asyncHandler wrapper.
 *    See: docs/19-error-handling.md
 */
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Mandatory review | Catches issues early | Slows down development |
| 24-hour review window | Timely feedback | May delay urgent fixes |
| Checklist-based review | Consistent quality | More time per review |
| Security-first review | Prevents vulnerabilities | May block on false positives |
| Constructive feedback | Knowledge sharing | Requires skilled reviewers |

## Cross-References

- **Coding standards**: See `docs/05-coding-standards.md`
- **Naming conventions**: See `docs/06-naming-conventions.md`
- **Security**: See `docs/22-security.md`
- **Performance**: See `docs/21-performance.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`
- **Git workflow**: See `docs/31-git-workflow.md`

## AI Instructions

When reviewing code:
1. Always use the review checklist
2. Always verify feature preservation
3. Always check security implications
4. Always check performance implications
5. Always provide constructive, specific feedback
6. Always reference documentation for standards
7. Never approve without verifying all criteria
8. Never block on stylistic preferences
9. Always explain why changes are needed
10. Always verify tests are included
