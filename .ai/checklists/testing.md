# Testing Checklist

> **Purpose:** Comprehensive checklist for all testing activities: unit tests, integration tests, E2E tests, test coverage, test quality, and test maintenance.
> **AI Instructions:** Use this checklist when writing, reviewing, or auditing tests. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed. Tests are not optional — they are a first-class deliverable.

---

## Unit Test Checklist

- [ ] **Every pure function has at least one test** — Pure functions (same input → same output, no side effects) are the easiest and most valuable to test. Start here.
- [ ] **Happy path is tested** — Verify the function works correctly with valid, expected inputs. This is the baseline.
- [ ] **Edge cases are tested** — Empty inputs, null/undefined values, zero values, maximum values, minimum values, empty strings, empty arrays.
  ```
  # Edge cases for a function that calculates a discount:
  - [ ] Zero quantity
  - [ ] Negative quantity (should it error?)
  - [ ] Maximum integer quantity
  - [ ] Discount rate of 0% (no discount)
  - [ ] Discount rate of 100% (free)
  - [ ] Discount rate > 100% (should it error?)
  - [ ] Negative discount (surcharge?)
  - [ ] NaN or Infinity as input
  - [ ] Null/undefined quantity
  ```
- [ ] **Boundary values are tested** — If a valid range is 1-100, test with 0, 1, 2, 99, 100, and 101. Boundary conditions are where most bugs live.
- [ ] **Error conditions are tested** — Verify that the function raises/returns the correct error for invalid inputs. Error messages are accurate and helpful.
- [ ] **Test names are descriptive** — Test names describe the scenario, not the implementation. Good: `calculateDiscount_returnsZero_whenQuantityIsNegative`. Bad: `test1` or `testCalculate`.
- [ ] **Tests are independent** — Each test can run in isolation. No test depends on the state created by another test. Tests can run in any order.
- [ ] **Tests are fast** — Unit tests should complete in milliseconds. If a unit test takes seconds, it's probably not a unit test (it's an integration test in disguise).
- [ ] **Mocks are used judiciously** — Mock external dependencies (databases, APIs, file system) but not internal functions. If you're mocking too much, the test isn't testing real behavior.
- [ ] **No test interdependence** — Tests don't share mutable global state. Each test creates its own data and cleans up after itself.
- [ ] **Assertions are specific** — Don't just assert "not null." Assert the exact expected value, type, and structure. Specific assertions catch more bugs.
  ```javascript
  // Bad
  expect(result).toBeTruthy();

  // Good
  expect(result).toEqual({
    id: 'usr_123',
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin'
  });
  ```
- [ ] **One assertion per concept** — Each test verifies one behavior. Multiple assertions in a test are fine if they verify the same concept (e.g., all properties of a returned object).
- [ ] **Arrange-Act-Assert pattern is followed** — Tests have clear sections: setup (Arrange), execution (Act), and verification (Assert). This makes tests readable and maintainable.
  ```python
  def test_calculate_total_with_tax():
      # Arrange
      cart = Cart()
      cart.add_item(price=100, quantity=2)
      tax_rate = 0.08

      # Act
      total = calculate_total(cart, tax_rate)

      # Assert
      assert total == 216.0  # (100 * 2) * 1.08
  ```

### Common Mistakes
- Testing implementation details instead of behavior
- Writing tests that pass due to bugs in the test setup
- Not testing error paths (they're where bugs hide the most)
- Tests that are so complex they need their own tests

---

## Integration Test Checklist

- [ ] **Database interactions are tested** — CRUD operations work correctly against a real (test) database. Migrations run cleanly. Constraints are enforced.
- [ ] **API integration is tested** — HTTP requests to your API endpoints return correct status codes, headers, and response bodies. Request validation works.
- [ ] **External service integration is tested (with test doubles)** — Third-party APIs (Stripe, Twilio, SendGrid) are tested with mocks or sandbox environments. Never hit production external services in tests.
- [ ] **Message queue integration is tested** — Messages are published and consumed correctly. Message serialization/deserialization works. Error handling for failed messages works.
- [ ] **Authentication flow is tested end-to-end** — Login, token refresh, token expiry, and logout work correctly. Unauthorized requests are properly rejected.
- [ ] **File system operations are tested** — File upload, download, and processing work correctly. Temporary files are cleaned up. File permissions are handled.
- [ ] **Cache integration is tested** — Cache hits return correct data. Cache misses trigger data fetch. Cache invalidation works. Cache expiry works.
- [ ] **Concurrent operations are tested** — Multiple simultaneous requests don't cause data corruption or race conditions. Optimistic locking works when implemented.
- [ ] **Error recovery is tested** — Application recovers gracefully when a dependency is temporarily unavailable. Retries work. Circuit breakers work.
- [ ] **Transaction boundaries are tested** — Multi-step operations either complete entirely or roll back entirely. Partial failures don't leave inconsistent data.
- [ ] **Test data is realistic** — Integration tests use data that represents real-world scenarios. Edge cases in production data (Unicode, very long strings, null fields) are represented.
- [ ] **Test isolation is maintained** — Each test starts with a clean database state. Use transactions that roll back after each test, or truncate tables between tests.

### Common Mistakes
- Hitting real external APIs in integration tests (flaky, slow, potentially costly)
- Not cleaning up test data (tests pass once, then fail on subsequent runs)
- Testing too much in integration tests (should be covered in unit tests)
- Integration tests that are too slow to run in CI (aim for <10 minutes)

---

## E2E Test Checklist

- [ ] **Critical user journeys are covered** — At minimum: registration, login, core functionality, payment (if applicable), and account management.
- [ ] **Tests simulate real user behavior** — Click buttons, fill forms, navigate pages, scroll, wait for loading states. Don't test API contracts in E2E tests.
- [ ] **Tests run against a production-like environment** — E2E tests run against a staging or test environment that mirrors production configuration. Not against a developer's machine.
- [ ] **Page objects or equivalent abstractions are used** — Don't scatter CSS selectors throughout tests. Use page objects, screen objects, or component objects to encapsulate selectors.
  ```javascript
  // Bad: Selector scattered throughout tests
  await page.click('[data-testid="add-to-cart-button"]');
  await page.fill('#email-input', 'user@example.com');

  // Good: Page object encapsulates selectors
  class ProductPage {
    constructor(page) { this.page = page; }
    async addToCart() {
      await this.page.click('[data-testid="add-to-cart-button"]');
    }
  }
  ```
- [ ] **Tests handle async operations correctly** — Wait for elements to appear, APIs to respond, and animations to complete. Don't use arbitrary `sleep()` — use explicit waits.
- [ ] **Screenshots/videos are captured on failure** — When a test fails, capture a screenshot and/or video of the browser state. Invaluable for debugging.
- [ ] **Test data is seeded before tests** — E2E tests depend on specific data being present. Seed scripts create the required state. Tests don't depend on data created by other tests.
- [ ] **Tests are deterministic** — Same test, same result every time. No randomness, no timing dependencies, no shared state between tests. Flaky E2E tests are quarantined and fixed.
- [ ] **Mobile viewports are tested** — Key user journeys work on mobile viewports. Touch interactions work. Responsive layouts render correctly.
- [ ] **Authentication in E2E tests is handled efficiently** — Don't fill out login forms in every test. Use API calls to get auth tokens and set them directly. Saves significant time.
- [ ] **Tests can run in parallel** — Independent test suites can run in parallel to reduce total test time. Each test suite uses its own test data.
- [ ] **Test environment is refreshed regularly** — The E2E test environment should be in a known state. Use containerized environments that are recreated for each test run.

### Common Mistakes
- Writing E2E tests for functionality better covered by unit/integration tests
- Using fixed `sleep()` calls instead of proper waits
- E2E tests that are so slow they're only run once a week
- Not cleaning up test data between runs
- Testing CSS styling in E2E tests (use visual regression tools instead)

---

## Test Coverage Checklist

- [ ] **Line coverage is measured** — Every line of code is executed by at least one test. Measure with istanbul/nyc, coverage.py, or language equivalent.
- [ ] **Branch coverage is measured** — Every branch (if/else, switch/case, ternary) is taken by at least one test. Branch coverage is more meaningful than line coverage.
- [ ] **Function coverage is measured** — Every function/method is called by at least one test. No untested public functions.
- [ ] **Critical paths have 100% coverage** — Payment processing, authentication, authorization, and data validation should have complete coverage.
- [ ] **Coverage thresholds are enforced** — CI pipeline fails if coverage drops below the threshold. Start with current coverage and ratchet upward.
  ```yaml
  # Example: Jest coverage thresholds
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 85,
      "lines": 85,
      "statements": 85
    }
  }
  ```
- [ ] **Coverage is tracked over time** — Coverage trends are visible (improving, stable, or declining). Coverage regressions are flagged in PRs.
- [ ] **New code has coverage requirements** — PRs adding new code must meet coverage threshold for the changed files. No new untested code.
- [ ] **Coverage gaps are documented** — Known coverage gaps (third-party integrations, legacy code) are documented with justification. Not just ignored.
- [ ] **Coverage is not gamed** — Don't write tests just to increase coverage numbers. Tests should catch real bugs. 100% coverage doesn't mean bug-free code.
- [ ] **Dead code is identified** — Code that's never executed by any test or production path is identified and removed. Dead code can't be tested.

### Common Mistakes
- Using coverage as a goal instead of a guide
- Writing shallow tests just to hit coverage targets
- Ignoring coverage entirely (untested code is a liability)
- Not measuring branch coverage (line coverage alone is insufficient)

---

## Test Quality Checklist

- [ ] **Tests are readable** — A new team member can understand what a test verifies without reading the implementation. Tests serve as living documentation.
- [ ] **Tests are maintainable** — When implementation changes, tests are updated, not deleted. Tests don't break due to internal refactoring that doesn't change behavior.
- [ ] **Tests have meaningful assertions** — Each assertion verifies something specific. "It works" is not an assertion — "it returns the correct total with tax" is.
- [ ] **Tests don't test framework internals** — Don't test that React renders a `div`. Don't test that your ORM builds SQL correctly. Test your application logic.
- [ ] **Test data is clear and intentional** — Don't use `test`, `foo`, `bar` as test data. Use descriptive, realistic data that makes the test self-documenting.
- [ ] **Tests follow AAA pattern consistently** — Arrange (setup), Act (execute), Assert (verify). This structure makes tests readable and debuggable.
- [ ] **Negative tests exist** — Test what happens when things go wrong: invalid input, missing data, permission denied, network failure, timeout. Error handling is tested.
- [ ] **Tests are self-contained** — Each test is a complete story. Reading the test tells you what's being tested, how, and what the expected outcome is.
- [ ] **Test complexity is appropriate** — Tests should be simpler than the code they test. If a test is complex, the implementation might be too complex.
- [ ] **Mutation testing is considered** — Use mutation testing (Stryker, mutmut) to verify that tests actually catch bugs. Mutants that survive indicate weak tests.
- [ ] **Tests are code-reviewed** — Test code goes through the same review process as production code. Poorly written tests are as harmful as poorly written production code.

### Common Mistakes
- Tests that are harder to understand than the code they test
- Tests that verify implementation details (break on refactoring)
- "Assertion-less" tests that don't actually verify anything
- Tests that require extensive setup that isn't clearly documented

---

## Test Maintenance Checklist

- [ ] **Flaky tests are tracked and fixed** — Tests that pass sometimes and fail sometimes are quarantined immediately. Root cause is identified (usually timing, shared state, or external dependency).
- [ ] **Disabled tests have tracked issues** — Any `skip`, `pending`, or `xtest` has a corresponding issue ticket. Disabled tests without tickets are re-enabled or deleted.
- [ ] **Test debt is included in sprint planning** — Test maintenance is not "extra work." It's included in sprint capacity and prioritized like any other technical debt.
- [ ] **Test infrastructure is maintained** — Test runners, test frameworks, and test utilities are kept up to date. Outdated test tools can produce false positives/negatives.
- [ ] **Test data management is maintained** — Test fixtures, factories, and seed data are kept in sync with schema changes. Outdated test data causes false failures.
- [ ] **Snapshot tests are reviewed** — Snapshot updates are reviewed, not just accepted. Verify the snapshot change is intentional, not a regression.
- [ ] **Test environment health is monitored** — Test databases, mock services, and test infrastructure are monitored. Flaky test environments are fixed promptly.
- [ ] **Old tests are cleaned up** — Tests for removed features are deleted. Tests that duplicate other tests are consolidated. Test suite should be lean and relevant.
- [ ] **Test documentation is maintained** — How to run tests, how to add new tests, and how to debug test failures is documented in the README or CONTRIBUTING guide.
- [ ] **Test run times are monitored** — If the test suite is getting slower, investigate. Slow tests reduce developer productivity and CI efficiency. Set performance budgets.
- [ ] **Test results are reported to the team** — CI/CD test results are visible to the team. Coverage reports, failure rates, and flaky test counts are shared regularly.

### Common Mistakes
- Ignoring flaky tests ("just re-run the CI")
- Accumulating disabled tests without tracking
- Not investing in test infrastructure (slow CI kills productivity)
- Deleting tests instead of fixing them when they break

---

## Cross-References

- See `backend.md` for backend-specific testing guidelines
- See `frontend.md` for frontend-specific testing guidelines
- See `api.md` for API contract testing
- See `database.md` for database-specific testing
- See `security.md` for security testing procedures
- See `deployment.md` for deployment smoke testing
- See `release.md` for release testing procedures
