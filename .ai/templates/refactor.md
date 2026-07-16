# Refactoring Template

## Purpose

Use this template when refactoring existing code to improve structure, readability, performance, or maintainability without changing external behavior.

## When to Use

- Code is becoming difficult to maintain
- Extracting a service from a route handler
- Moving from callbacks to async/await
- Breaking up large files/functions
- Improving testability
- Reducing code duplication
- Modernizing deprecated patterns

---

## Step-by-Step Process

### 1. Understand the Current State

Before changing anything:

1. Read and understand the existing code thoroughly
2. Identify all callers and consumers
3. Check for existing tests
4. Document the current behavior
5. Note any side effects or dependencies

### 2. Define the Target State

1. Describe what the refactored code will look like
2. Define the new interfaces/contracts
3. Identify breaking changes (if any)
4. Plan the migration path

### 3. Write Characterization Tests

If tests don't exist:

1. Write tests that capture current behavior
2. Run tests to confirm they pass
3. These tests become your safety net

### 4. Refactor Incrementally

1. Make one small change at a time
2. Run tests after each change
3. Commit after each successful refactor step
4. Never refactor and add features simultaneously

### 5. Verify Behavior Preservation

1. All existing tests pass
2. Manual testing confirms same behavior
3. No API contract changes (unless planned)
4. Performance is not degraded

### 6. Update Documentation

1. Update code comments
2. Update relevant documentation
3. Update architecture diagrams if applicable

---

## Feature Preservation Verification

```markdown
## Verification Checklist

### Functional Verification
- [ ] All existing tests pass
- [ ] New characterization tests written
- [ ] Manual testing completed
- [ ] Edge cases still work
- [ ] Error handling unchanged
- [ ] API contracts preserved

### Performance Verification
- [ ] Response times not degraded
- [ ] Memory usage not increased
- [ ] Database queries not multiplied
- [ ] No N+1 query issues introduced

### Security Verification
- [ ] Authentication still required
- [ ] Authorization still enforced
- [ ] Input validation still present
- [ ] No new attack vectors

### Compatibility Verification
- [ ] Backwards compatible
- [ ] Frontend still works
- [ ] API consumers unaffected
- [ ] Database schema unchanged (or migrated)
```

---

## Incremental Refactoring Steps

### Pattern 1: Extract Service from Route Handler

```markdown
Step 1: Identify the business logic in the route handler
Step 2: Create a new service file
Step 3: Move logic to service, one function at a time
Step 4: Update route handler to call service
Step 5: Add tests for the service
Step 6: Verify all existing tests pass
```

### Pattern 2: Extract Utility Functions

```markdown
Step 1: Identify repeated code
Step 2: Create utility module
Step 3: Move one piece of logic at a time
Step 4: Update all callers
Step 5: Remove original code
Step 6: Verify tests pass
```

### Pattern 3: Convert Callbacks to Promises

```markdown
Step 1: Identify callback-based code
Step 2: Wrap in Promise (if not already)
Step 3: Convert one function at a time
Step 4: Update callers to use async/await
Step 5: Remove callback parameters
Step 6: Verify tests pass
```

### Pattern 4: Break Up Large Files

```markdown
Step 1: Identify logical groupings in the file
Step 2: Create new files for each group
Step 3: Move exports one group at a time
Step 4: Update imports in all consumers
Step 5: Delete original file
Step 6: Verify tests pass
```

---

## Testing Strategy

```markdown
## Testing Approach

### Before Refactoring
1. Check existing test coverage
2. Add characterization tests for uncovered code
3. Ensure all tests pass

### During Refactoring
1. Run tests after each change
2. Use test watchers for immediate feedback
3. Keep test suite fast

### After Refactoring
1. Run full test suite
2. Add tests for new code structure
3. Remove obsolete tests
4. Update test documentation
```

---

## Rollback Plan

```markdown
## Rollback Strategy

### Before Starting
1. Create a branch for the refactor
2. Commit current state as baseline
3. Document rollback procedure

### If Refactor Fails
1. Stop refactoring
2. Run full test suite
3. If tests fail, revert to last good commit
4. Document what went wrong
5. Plan revised approach

### Rollback Commands
```bash
# Revert to last good commit
git revert HEAD

# Or reset to specific commit
git reset --hard <commit-hash>

# Force push if needed (use with caution)
git push --force-with-lease
```

### After Rollback
1. Verify system is working
2. Document why rollback was needed
3. Plan revised refactoring approach
```

---

## Complete Example: Extracting a Service from a Route Handler

### Before: Monolithic Route Handler

```typescript
// routes/customers.ts (BEFORE)
import { Router, Request, Response } from "express";
import { db } from "../database";
import { sendEmail } from "../email";
import { logger } from "../logger";

const router = Router();

router.post("/customers", async (req: Request, res: Response) => {
  try {
    const { name, email, company, phone } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Check for duplicate email
    const existing = await db.query(
      "SELECT id FROM customers WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Create customer
    const result = await db.query(
      `INSERT INTO customers (name, email, company, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [name, email, company, phone]
    );

    const customer = result.rows[0];

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: "Welcome!",
        template: "welcome",
        data: { name, company },
      });
      logger.info(`Welcome email sent to ${email}`);
    } catch (emailError) {
      logger.error("Failed to send welcome email", emailError);
      // Don't fail the request if email fails
    }

    // Create default settings
    await db.query(
      `INSERT INTO customer_settings (customer_id, notifications, theme)
       VALUES ($1, true, 'light')`,
      [customer.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_log (customer_id, action, details)
       VALUES ($1, 'created', $2)`,
      [customer.id, JSON.stringify({ name, email })]
    );

    return res.status(201).json({ data: customer });
  } catch (error) {
    logger.error("Failed to create customer", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, cs.notifications, cs.theme
       FROM customers c
       LEFT JOIN customer_settings cs ON cs.customer_id = c.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];

    // Get order count
    const orderCount = await db.query(
      "SELECT COUNT(*) as count FROM orders WHERE customer_id = $1",
      [id]
    );

    // Get total spent
    const totalSpent = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE customer_id = $1",
      [id]
    );

    return res.json({
      data: {
        ...customer,
        orderCount: parseInt(orderCount.rows[0].count),
        totalSpent: parseFloat(totalSpent.rows[0].total),
      },
    });
  } catch (error) {
    logger.error("Failed to get customer", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

### Step 1: Create the Customer Service

```typescript
// services/customer-service.ts
import { db } from "../database";
import { sendEmail } from "../email";
import { logger } from "../logger";

export interface CreateCustomerInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerWithStats extends Customer {
  orderCount: number;
  totalSpent: number;
  notifications: boolean;
  theme: string;
}

export class CustomerService {
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const { name, email, company, phone } = input;

    // Check for duplicate email
    const existing = await db.query(
      "SELECT id FROM customers WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      throw new DuplicateEmailError(email);
    }

    // Create customer
    const result = await db.query(
      `INSERT INTO customers (name, email, company, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [name, email, company, phone]
    );

    const customer = result.rows[0];

    // Create default settings
    await db.query(
      `INSERT INTO customer_settings (customer_id, notifications, theme)
       VALUES ($1, true, 'light')`,
      [customer.id]
    );

    // Send welcome email (fire and forget)
    this.sendWelcomeEmail(email, name, company).catch((err) => {
      logger.error("Failed to send welcome email", err);
    });

    // Log activity
    await this.logActivity(customer.id, "created", { name, email });

    return customer;
  }

  async getCustomerById(id: string): Promise<CustomerWithStats | null> {
    const result = await db.query(
      `SELECT c.*, cs.notifications, cs.theme
       FROM customers c
       LEFT JOIN customer_settings cs ON cs.customer_id = c.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const customer = result.rows[0];

    // Get order statistics
    const [orderCount, totalSpent] = await Promise.all([
      db.query(
        "SELECT COUNT(*) as count FROM orders WHERE customer_id = $1",
        [id]
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE customer_id = $1",
        [id]
      ),
    ]);

    return {
      ...customer,
      orderCount: parseInt(orderCount.rows[0].count),
      totalSpent: parseFloat(totalSpent.rows[0].total),
    };
  }

  async emailExists(email: string): Promise<boolean> {
    const result = await db.query(
      "SELECT id FROM customers WHERE email = $1",
      [email]
    );
    return result.rows.length > 0;
  }

  private async sendWelcomeEmail(
    email: string,
    name: string,
    company?: string
  ): Promise<void> {
    await sendEmail({
      to: email,
      subject: "Welcome!",
      template: "welcome",
      data: { name, company },
    });
    logger.info(`Welcome email sent to ${email}`);
  }

  private async logActivity(
    customerId: string,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await db.query(
      `INSERT INTO activity_log (customer_id, action, details)
       VALUES ($1, $2, $3)`,
      [customerId, action, JSON.stringify(details)]
    );
  }
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
    this.name = "DuplicateEmailError";
  }
}
```

### Step 2: Refactor the Route Handler

```typescript
// routes/customers.ts (AFTER)
import { Router, Request, Response } from "express";
import { CustomerService, DuplicateEmailError } from "../services/customer-service";
import { logger } from "../logger";

const router = Router();
const customerService = new CustomerService();

router.post("/customers", async (req: Request, res: Response) => {
  try {
    const { name, email, company, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const customer = await customerService.createCustomer({
      name,
      email,
      company,
      phone,
    });

    return res.status(201).json({ data: customer });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return res.status(409).json({ error: error.message });
    }

    logger.error("Failed to create customer", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await customerService.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({ data: customer });
  } catch (error) {
    logger.error("Failed to get customer", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

### Step 3: Add Service Tests

```typescript
// tests/services/customer-service.test.ts
import { CustomerService, DuplicateEmailError } from "../../services/customer-service";
import { db } from "../../database";

jest.mock("../../database");
jest.mock("../../email");

describe("CustomerService", () => {
  let service: CustomerService;

  beforeEach(() => {
    service = new CustomerService();
    jest.clearAllMocks();
  });

  describe("createCustomer", () => {
    it("creates a customer successfully", async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check duplicate
        .mockResolvedValueOnce({ rows: [{ id: "1", name: "John", email: "john@test.com" }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }) // Settings
        .mockResolvedValueOnce({ rows: [] }); // Activity log

      const result = await service.createCustomer({
        name: "John",
        email: "john@test.com",
      });

      expect(result).toEqual({ id: "1", name: "John", email: "john@test.com" });
      expect(db.query).toHaveBeenCalledTimes(4);
    });

    it("throws DuplicateEmailError for existing email", async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: "existing" }],
      });

      await expect(
        service.createCustomer({ name: "John", email: "existing@test.com" })
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  describe("getCustomerById", () => {
    it("returns customer with stats", async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: "1", name: "John", notifications: true, theme: "light" }],
        })
        .mockResolvedValueOnce({ rows: [{ count: "5" }] })
        .mockResolvedValueOnce({ rows: [{ total: "500" }] });

      const result = await service.getCustomerById("1");

      expect(result).toEqual({
        id: "1",
        name: "John",
        notifications: true,
        theme: "light",
        orderCount: 5,
        totalSpent: 500,
      });
    });

    it("returns null for non-existent customer", async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getCustomerById("nonexistent");

      expect(result).toBeNull();
    });
  });
});
```

### Step 4: Verify All Tests Pass

```bash
# Run the full test suite
npm test

# Run specific test file
npm test -- tests/services/customer-service.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Refactoring Checklist

### Before Refactoring

- [ ] Current code fully understood
- [ ] All callers identified
- [ ] Existing tests identified
- [ ] Characterization tests written (if needed)
- [ ] Target state defined
- [ ] Branch created for refactor
- [ ] Team notified of refactor

### During Refactoring

- [ ] Changes are incremental
- [ ] Tests run after each change
- [ ] Code compiles without errors
- [ ] No new warnings introduced
- [ ] Each change is committed separately
- [ ] No feature changes mixed in

### After Refactoring

- [ ] All tests pass
- [ ] Code coverage maintained or improved
- [ ] Performance benchmarks checked
- [ ] Documentation updated
- [ ] Team review completed
- [ ] Old code removed
- [ ] No dead code left behind

---

## Common Mistakes to Avoid

1. **Refactoring and adding features** - Never mix refactoring with feature work
2. **Big bang refactoring** - Make small, incremental changes
3. **No tests before refactoring** - Always have a safety net
4. **Breaking public APIs** - Maintain backwards compatibility
5. **Not committing frequently** - Commit after each successful step
6. **Ignoring performance** - Profile before and after
7. **Leaving dead code** - Remove unused code completely
8. **Not updating documentation** - Keep docs in sync
9. **Refactoring alone** - Get team review for large refactors
10. **Skipping code review** - Even for "obvious" refactors

---

## Cross-References

- See `new-feature.md` for when refactoring is part of adding a feature
- See `bug-fix.md` for fixing bugs found during refactoring
- See `service.md` for the target service structure
- See `controller.md` for the target controller structure
