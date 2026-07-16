# Bug Fix Template

## Purpose

Use this template when fixing a bug in the codebase. This covers the full lifecycle from reproducing the bug through to verifying the fix and preventing regressions.

## When to Use

- A reported bug needs fixing
- An unexpected behavior is discovered
- A regression from a previous change
- Edge case handling failure
- Data inconsistency issues

---

## Step-by-Step Process

### 1. Reproduce the Bug

Before fixing anything, you must reliably reproduce the issue:

1. Gather the bug report details (steps, environment, expected vs actual)
2. Reproduce the bug in development
3. Document the exact reproduction steps
4. Note the environment details (browser, OS, data state)
5. Capture screenshots or logs if applicable

### 2. Identify the Root Cause

Do not jump to the fix immediately:

1. Read the error message and stack trace carefully
2. Add debugging logs if needed
3. Use breakpoints to trace execution flow
4. Check related code paths
5. Identify the exact line/condition causing the issue
6. Determine if the bug is isolated or systemic

### 3. Plan the Fix

Before writing code:

1. Identify the minimal change needed
2. Consider side effects of the change
3. Check if similar bugs exist elsewhere
4. Decide if the fix needs to be backwards compatible
5. Plan any schema/data migration if needed

### 4. Implement the Fix

1. Write the fix with clear, focused changes
2. Add comments explaining why the change was made
3. Keep the fix minimal and targeted
4. Follow existing code conventions

### 5. Test the Fix

1. Verify the original bug is fixed
2. Run existing tests to check for regressions
3. Add new tests for the bug scenario
4. Test edge cases related to the fix
5. Test on different environments if applicable

### 6. Document the Fix

1. Update relevant documentation
2. Add comments in code if the fix is non-obvious
3. Update CHANGELOG if applicable
4. Note the fix in PR description

---

## Reproduction Steps Template

```markdown
## Bug Report

**Title:** [Brief description]
**Priority:** [Critical/High/Medium/Low]
**Environment:** [Production/Staging/Development]
**Reporter:** [Name]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots/Logs
[If applicable]

### Environment Details
- Browser: [Version]
- OS: [Version]
- API Version: [Version]
- Database State: [Any specific data requirements]
```

---

## Root Cause Analysis Template

```markdown
## Root Cause Analysis

### Symptom
[Observable behavior]

### Direct Cause
[The code/condition that directly produces the bug]

### Root Cause
[The underlying reason this code/condition exists]

### Affected Code
- File: `path/to/file.ts:line_number`
- Function: `functionName`
- Condition: `the problematic condition`

### Why This Happened
[Was it a logic error, missing validation, race condition, etc.?]

### Impact Assessment
- [ ] Data integrity affected
- [ ] Security vulnerability
- [ ] Performance degradation
- [ ] User-facing issue only
- [ ] Backend issue only
```

---

## Regression Testing Template

```markdown
## Regression Tests

### Test Case 1: Original Bug Scenario
- **Input:** [Specific input that triggered the bug]
- **Expected:** [Correct behavior]
- **Status:** [Pass/Fail]

### Test Case 2: Related Edge Case
- **Input:** [Edge case input]
- **Expected:** [Correct behavior]
- **Status:** [Pass/Fail]

### Test Case 3: Inverse Scenario
- **Input:** [Opposite condition]
- **Expected:** [Correct behavior]
- **Status:** [Pass/Fail]

### Existing Test Suite
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No new warnings introduced
```

---

## Complete Example: Fixing a Calculation Bug

### Bug Report

**Title:** Tax calculation uses wrong rate for international customers
**Priority:** High
**Environment:** Production

### Steps to Reproduce

1. Login as a user with a non-US address
2. Add a product priced at $100 to cart
3. Go to checkout
4. Observe the tax amount shows $8.00 (US rate) instead of $0.00 (international)

### Expected Behavior

International customers should not be charged US sales tax.

### Actual Behavior

All customers are charged the US tax rate regardless of location.

---

### Root Cause Analysis

**Symptom:** International customers charged US tax rate

**Direct Cause:** In `calculate-tax.ts:45`, the tax calculation always uses the US tax rate:
```typescript
// BUG: Always uses US rate
const taxRate = getTaxRate("US");
return subtotal * taxRate;
```

**Root Cause:** The function ignores the customer's country parameter.

**Affected Code:**
- File: `services/calculation/calculate-tax.ts:45`
- Function: `calculateTax`
- Issue: Country parameter not passed to `getTaxRate`

**Why This Happened:** When international support was added, the tax calculation was not updated.

**Impact Assessment:**
- [x] Data integrity affected (incorrect charges)
- [ ] Security vulnerability
- [ ] Performance degradation
- [x] User-facing issue only

---

### The Fix

```typescript
// BEFORE (buggy code)
export function calculateTax(subtotal: number, customerCountry: string): number {
  const taxRate = getTaxRate("US");
  return subtotal * taxRate;
}

// AFTER (fixed code)
export function calculateTax(subtotal: number, customerCountry: string): number {
  const taxRate = getTaxRate(customerCountry);

  // No tax for international customers (US-only taxation)
  if (customerCountry !== "US") {
    return 0;
  }

  return subtotal * taxRate;
}
```

### Why This Fix

The fix passes the `customerCountry` parameter to `getTaxRate` instead of hardcoding "US". This is the minimal change that addresses the root cause while maintaining backwards compatibility.

---

### Tests Added

```typescript
// tests/services/calculation/calculate-tax.test.ts

describe("calculateTax", () => {
  it("calculates US tax correctly", () => {
    const result = calculateTax(100, "US");
    expect(result).toBe(8.0); // 8% tax rate
  });

  it("returns zero for international customers", () => {
    const result = calculateTax(100, "CA");
    expect(result).toBe(0);
  });

  it("returns zero for UK customers", () => {
    const result = calculateTax(100, "GB");
    expect(result).toBe(0);
  });

  it("handles zero subtotal", () => {
    const result = calculateTax(0, "US");
    expect(result).toBe(0);
  });

  it("handles large amounts correctly", () => {
    const result = calculateTax(999999.99, "US");
    expect(result).toBeCloseTo(79999.9992, 2);
  });
});
```

### Existing Tests Updated

```typescript
// tests/checkout/checkout.test.ts

describe("Checkout", () => {
  it("applies correct tax for US customer", async () => {
    const checkout = await createCheckout({
      userId: usUser.id,
      items: [{ productId: "prod-1", quantity: 1, price: 100 }],
    });

    expect(checkout.tax).toBe(8.0);
    expect(checkout.total).toBe(108.0);
  });

  it("applies zero tax for international customer", async () => {
    const checkout = await createCheckout({
      userId: intlUser.id,
      items: [{ productId: "prod-1", quantity: 1, price: 100 }],
    });

    expect(checkout.tax).toBe(0);
    expect(checkout.total).toBe(100.0);
  });
});
```

---

### Verification Checklist

- [x] Bug is fixed in development
- [x] All new tests pass
- [x] All existing tests pass
- [x] No TypeScript errors
- [x] No linting errors
- [x] Tested with US customer
- [x] Tested with international customer
- [x] Tested with zero subtotal
- [x] Tested with edge cases
- [x] Documentation updated
- [x] No performance regression
- [x] Backwards compatible

---

### Related Bugs to Check

After fixing a bug, always check for similar issues:

1. **Similar calculation bugs:**
   - [ ] Shipping calculation uses correct country
   - [ ] Discount calculation uses correct currency
   - [ ] Currency conversion uses correct rates

2. **Similar parameter-passing bugs:**
   - [ ] All functions receiving country parameter use it
   - [ ] No hardcoded country values elsewhere

3. **Related features:**
   - [ ] Tax reporting uses correct rates
   - [ ] Invoice generation uses correct tax
   - [ ] Refunds use correct tax amount

---

## Common Mistakes to Avoid

1. **Fixing the symptom, not the cause** - Always trace to root cause
2. **Over-engineering the fix** - Keep changes minimal and focused
3. **Not writing tests** - Every bug fix needs a regression test
4. **Skipping existing tests** - Run the full test suite
5. **Not checking for similar bugs** - Look for the same pattern elsewhere
6. **Making breaking changes** - Ensure backwards compatibility
7. **Not documenting the fix** - Future developers need context
8. **Rushing to close the bug** - Verify thoroughly before marking done
9. **Forgetting edge cases** - Test boundary conditions
10. **Not communicating the fix** - Notify affected stakeholders

---

## Fix Documentation Template

```markdown
## Fix Summary

**Bug:** [Link to bug report]
**Fix PR:** [Link to PR]
**Fixed By:** [Name]
**Date:** [Date]

### What Was Wrong
[1-2 sentence summary]

### What Was Changed
[Specific files and changes]

### How to Verify
[Steps to confirm the fix]

### Rollback Plan
[How to revert if the fix causes issues]

### Follow-up Tasks
- [ ] [Any related improvements]
- [ ] [Any technical debt created]
```

---

## Cross-References

- See `new-feature.md` for adding features that might prevent similar bugs
- See `refactor.md` for refactoring to prevent bug-prone patterns
- See `api.md` for API-level error handling
- See `service.md` for service-level validation
