# 28 - Feature Preservation

## Purpose

This document defines the absolute rules for feature preservation in the KMJ Optical ERP system. Every code change, refactoring, or architectural modification must preserve all existing functionality unless explicitly authorized by the Chief Architect. Feature preservation is the highest priority.

## Core Principles

1. **NEVER remove functionality** without explicit Chief Architect approval.
2. **NEVER simplify business logic** without understanding the full business impact.
3. **NEVER change API contracts** without versioning and migration plan.
4. **NEVER change database schema** without migration plan and rollback.
5. **Always verify feature parity** before completing any change.

## Detailed Rules

### Rule 1: NEVER Remove Functionality

Every feature in the KMJ Optical ERP exists because a business stakeholder needs it. Removing a feature—even if it seems unused—can break business workflows.

**Absolute prohibitions**:
1. Never remove an API endpoint.
2. Never remove a database field.
3. Never remove a UI component or page.
4. Never remove a permission check.
5. Never remove an audit log entry.
6. Never remove a WhatsApp notification trigger.
7. Never remove a validation rule.
8. Never remove a report or dashboard metric.
9. Never remove a scheduled task.
10. Never remove a webhook or event handler.

**Exceptions** (require Chief Architect approval):
- Feature is explicitly confirmed as obsolete by business owner
- Feature has a documented replacement that provides identical functionality
- Feature poses a security risk and cannot be secured

```typescript
// BAD: Removing "unused" fields
// Before:
interface ICustomer {
  name: string;
  mobile: string;
  alternateMobile?: string;  // "Nobody uses this"
  tags?: string[];           // "This is never populated"
}

// After (WRONG):
interface ICustomer {
  name: string;
  mobile: string;
}

// GOOD: Preserving all fields
interface ICustomer {
  name: string;
  mobile: string;
  alternateMobile?: string;
  tags?: string[];
}
```

### Rule 2: NEVER Simplify Business Logic

Business logic encodes real-world business rules. Simplifying it can break business workflows.

**Absolute prohibitions**:
1. Never simplify order status transitions.
2. Never simplify payment calculations.
3. Never simplify discount logic.
4. Never simplify tax calculations.
5. Never simplify inventory tracking.
6. Never simplify delivery scheduling.
7. Never simplify customer relationship calculations.

```typescript
// BAD: Simplifying payment logic
// Before:
async function processPayment(billId: string, amount: number, mode: string) {
  const bill = await Bill.findById(billId);
  if (!bill) throw new AppError(404, 'Bill not found');

  const remaining = bill.totalAmount - bill.advancePaid;
  if (amount > remaining) {
    throw new AppError(400, 'Amount exceeds pending amount');
  }

  // Record payment
  await Payment.create({ billId, amount, mode, date: new Date() });

  // Update bill
  await Bill.findByIdAndUpdate(billId, {
    $inc: { advancePaid: amount, pendingAmount: -amount }
  });

  // Update customer pending amount
  await Customer.findByIdAndUpdate(bill.customerId, {
    $inc: { pendingAmount: -amount }
  });
}

// After (WRONG - simplified, missing validation):
async function processPayment(billId: string, amount: number) {
  await Bill.findByIdAndUpdate(billId, {
    $inc: { advancePaid: amount, pendingAmount: -amount }
  });
}

// GOOD: Preserving all business logic
async function processPayment(billId: string, amount: number, mode: string) {
  // All original validation and logic preserved
}
```

### Rule 3: NEVER Change API Contracts

API contracts are the agreement between frontend and backend. Changing them breaks the frontend.

**Rules**:
1. Never change the shape of API responses.
2. Never change the meaning of API parameters.
3. Never change HTTP status codes for existing responses.
4. Never change authentication requirements for existing endpoints.
5. Never change rate limiting behavior for existing endpoints.

**If a change is needed**:
1. Add new endpoint with new behavior
2. Deprecate old endpoint with warning headers
3. Migrate frontend to new endpoint
4. Remove old endpoint after migration period

```typescript
// BAD: Changing response shape
// Before:
res.json({ success: true, data: customers });
// After:
res.json({ success: true, customers: customers }); // Frontend breaks!

// GOOD: Adding new field without breaking existing
res.json({
  success: true,
  data: customers,
  pagination: { page, limit, total } // Added, not replacing
});
```

### Rule 4: NEVER Change Database Schema Without Migration

Database schema changes can corrupt data or break queries.

**Rules**:
1. Always write a migration script before changing schema.
2. Always make migrations reversible (up and down).
3. Always test migrations on a copy of production data.
4. Always backup before running migrations.
5. Never drop collections without explicit approval.

```typescript
// BAD: Adding field without migration
// Just adding to schema without populating existing documents:
const customerSchema = new Schema({
  name: String,
  mobile: String,
  loyaltyPoints: { type: Number, default: 0 }, // New field
});

// Existing documents now have undefined loyaltyPoints
// Any code using $inc on loyaltyPoints will fail on existing docs

// GOOD: Migration script
export async function up() {
  await mongoose.connection.db.collection('customers').updateMany(
    { loyaltyPoints: { $exists: false } },
    { $set: { loyaltyPoints: 0 } }
  );
}

export async function down() {
  await mongoose.connection.db.collection('customers').updateMany(
    {},
    { $unset: { loyaltyPoints: '' } }
  );
}
```

### Rule 5: Feature Parity Verification

Before completing any change, you MUST verify feature parity across all dimensions.

**API Parity Checklist**:
- [ ] All endpoints return same data shape
- [ ] All endpoints return same HTTP status codes
- [ ] All endpoints enforce same authentication
- [ ] All endpoints enforce same authorization
- [ ] All endpoints validate same inputs

**Database Parity Checklist**:
- [ ] All existing data is preserved
- [ ] All fields have correct defaults
- [ ] All indexes are maintained
- [ ] All relationships are intact

**UI Parity Checklist**:
- [ ] All pages render correctly
- [ ] All forms work correctly
- [ ] All buttons work correctly
- [ ] All navigation works correctly
- [ ] All loading states work correctly
- [ ] All error states work correctly

**Permission Parity Checklist**:
- [ ] All role-based access controls work
- [ ] All branch-based access controls work
- [ ] All audit logs are generated
- [ ] All sensitive data is protected

**Report Parity Checklist**:
- [ ] All reports show correct data
- [ ] All dashboard metrics are accurate
- [ ] All export functions work
- [ ] All calculations are correct

```typescript
// GOOD: Feature parity verification script
async function verifyFeatureParity(): Promise<FeatureParityReport> {
  const report: FeatureParityReport = {
    api: await verifyAPIParity(),
    database: await verifyDatabaseParity(),
    ui: await verifyUIParity(),
    permissions: await verifyPermissionParity(),
    reports: await verifyReportParity(),
    timestamp: new Date(),
  };

  const allPassed = Object.values(report).every(
    result => typeof result === 'boolean' ? result : result.passed
  );

  if (!allPassed) {
    throw new Error('Feature parity verification failed');
  }

  return report;
}
```

### Refactoring Requirements

Every refactoring MUST prove feature parity by:

1. **API Parity**: All existing endpoints return same data
2. **Database Parity**: All existing data is preserved
3. **UI Parity**: All existing pages look and work the same
4. **Permission Parity**: All existing access controls work the same
5. **Report Parity**: All existing reports show same data
6. **Audit Parity**: All existing audit logs are generated
7. **Workflow Parity**: All existing workflows complete successfully

### Proof of Feature Parity

Before completing any refactoring, you MUST:

1. Run all existing tests
2. Write new tests for any untested code affected
3. Verify all API endpoints return same responses
4. Verify all database queries return same results
5. Verify all UI pages render correctly
6. Verify all permissions are enforced
7. Verify all audit logs are generated
8. Verify all reports show correct data
9. Document all changes in the commit message
10. Update all affected documentation

## Bad Examples

```typescript
// BAD: Removing "unused" validation
// Before:
const createCustomerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  email: z.string().email().optional(),
  age: z.number().min(0).max(150).optional(),
});

// After (WRONG - removed validation):
const createCustomerSchema = z.object({
  name: z.string(),
  mobile: z.string(),
});

// GOOD: Preserving all validation
const createCustomerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  email: z.string().email().optional(),
  age: z.number().min(0).max(150).optional(),
});
```

```typescript
// BAD: Simplifying order status pipeline
// Before:
const VALID_TRANSITIONS = {
  Draft: ['Ordered', 'Cancelled'],
  Ordered: ['In Lab', 'Cancelled'],
  'In Lab': ['Ready', 'Cancelled'],
  Ready: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

// After (WRONG - allowing all transitions):
function canTransition(from: string, to: string): boolean {
  return true; // "Simplified"
}

// GOOD: Preserving all transition rules
function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

## Good Examples

```typescript
// GOOD: Safe refactoring that preserves features
// Step 1: Add new field alongside old field
// Step 2: Write migration to populate new field
// Step 3: Update code to use new field
// Step 4: Verify feature parity
// Step 5: Remove old field (after migration period)

// Step 1: Schema change
const customerSchema = new Schema({
  name: String,
  mobile: String,
  // New field, old field preserved
  normalizedMobile: { type: String, index: true },
});

// Step 2: Migration
export async function up() {
  const customers = await mongoose.connection.db.collection('customers').find().toArray();
  for (const customer of customers) {
    await mongoose.connection.db.collection('customers').updateOne(
      { _id: customer._id },
      { $set: { normalizedMobile: customer.mobile?.replace(/\D/g, '') } }
    );
  }
}

// Step 3: Update code (both old and new work)
async function findCustomerByMobile(mobile: string) {
  const normalized = mobile.replace(/\D/g, '');
  return Customer.findOne({
    $or: [
      { normalizedMobile: normalized },
      { mobile: mobile },
    ],
  });
}

// Step 4: Verify feature parity (manual + automated tests)

// Step 5: Remove old field (after deprecation period)
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Preserve all features | No business disruption | Technical debt accumulates |
| Feature parity verification | Catches regressions | Time-consuming |
| Migration scripts | Safe schema changes | More development time |
| Deprecation periods | Smooth transitions | Old code lingers |
| Comprehensive testing | Confidence in changes | Test maintenance burden |

## Cross-References

- **Architecture decision records**: See `docs/42-decision-engine.md`
- **Refactoring guidelines**: See `docs/29-refactoring.md`
- **Database migrations**: See `docs/12-database.md`
- **API contracts**: See `docs/14-api-design.md`
- **Code review**: See `docs/30-code-review.md`

## AI Instructions

When making changes to this codebase:
1. NEVER remove functionality without explicit Chief Architect approval
2. NEVER simplify business logic without understanding the full impact
3. NEVER change API contracts without versioning
4. NEVER change database schema without migration
5. ALWAYS verify feature parity before completing changes
6. ALWAYS preserve all existing fields, endpoints, and validations
7. ALWAYS write migration scripts for schema changes
8. ALWAYS test all existing functionality after changes
9. ALWAYS document what was preserved and what changed
10. When in doubt, preserve the existing behavior
