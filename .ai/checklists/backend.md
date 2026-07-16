# Backend Development Checklist

> **Purpose:** Comprehensive checklist for backend development tasks including architecture, code quality, security, performance, testing, and deployment readiness.
> **AI Instructions:** Use this checklist when performing any backend development work. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Do not skip sections — every section must be explicitly addressed.

---

## Pre-Development Checklist

Before writing any code, ensure the foundation is solid.

- [ ] **Requirements are clearly understood** — Review all user stories, acceptance criteria, and edge cases before starting. Ambiguity in requirements is the #1 cause of rework.
- [ ] **Technical design document is reviewed and approved** — For significant features, a design doc should exist with architecture decisions, data models, and API contracts.
- [ ] **Existing codebase patterns are studied** — Before introducing new patterns, check how existing modules are structured. Consistency beats cleverness.
- [ ] **Dependencies are vetted** — Check npm/pip/cargo registries for license compatibility, maintenance status, download counts, and known vulnerabilities.
- [ ] **Database schema changes are planned** — If the feature requires new tables or columns, draft the migration before writing application code.
- [ ] **API contract is defined** — Endpoint paths, request/response schemas, and status codes should be agreed upon before implementation.
- [ ] **Error scenarios are enumerated** — List every failure mode: network timeouts, invalid input, permission denied, resource not found, rate limits, etc.
- [ ] **Logging strategy is defined** — Decide what gets logged, at what level, and where logs are shipped. Don't leave this to the end.
- [ ] **Environment requirements are documented** — Runtime version, system dependencies, environment variables, and external service dependencies.
- [ ] **Branch strategy is confirmed** — Know whether you're working on `main`, `develop`, or a feature branch. Follow the team's Git workflow.

### Common Mistakes
- Jumping into code without understanding the full scope
- Assuming external API behavior without reading their documentation
- Not checking if a similar feature already exists in the codebase

---

## Code Quality Checklist

- [ ] **Follows established code style** — Linter and formatter configured and passing. No manual formatting inconsistencies.
- [ ] **No hardcoded values** — All magic numbers, strings, URLs, and credentials are extracted to configuration or constants with descriptive names.
- [ ] **Functions are single-purpose** — Each function does one thing. If you can't describe it without "and", split it.
- [ ] **Error handling is explicit** — Every error path is handled. No silent failures. Use structured error types, not string messages.
  ```python
  # Bad
  try:
      do_something()
  except:
      pass

  # Good
  try:
      do_something()
  except ConnectionError as e:
      logger.error("Failed to connect to service", extra={"error": str(e)})
      raise ServiceUnavailableError("Upstream service unreachable") from e
  ```
- [ ] **Input validation at boundaries** — Validate all external input (HTTP requests, message queues, file uploads) at the earliest possible point.
- [ ] **No circular dependencies** — Module dependency graph is a DAG (directed acyclic graph). If you see circular imports, refactor.
- [ ] **Return types are documented** — Use type hints/annotations for all function signatures. IDE autocomplete depends on this.
- [ ] **Resource cleanup is guaranteed** — Use context managers (`with` statements) or try/finally blocks for file handles, DB connections, and locks.
- [ ] **Idempotency is considered** — If the operation can be retried (network failures, user double-clicks), ensure it's safe to retry.
- [ ] **Code is testable** — Functions receive dependencies as parameters (dependency injection), not imported globally. Side effects are isolated.
- [ ] **No premature optimization** — Write clear code first. Profile before optimizing. Comment why non-obvious optimizations exist.
- [ ] **Naming conventions are consistent** — Variables, functions, classes, and modules follow the project's naming conventions (snake_case, camelCase, PascalCase).
- [ ] **Dead code is removed** — No commented-out code blocks. No unused imports. No unreachable branches. Use version control history instead.

### Common Mistakes
- Catching broad exceptions and swallowing them
- Returning different types based on success/failure instead of using exceptions
- Over-engineering solutions for hypothetical future requirements

---

## Security Checklist

- [ ] **No secrets in code** — No API keys, passwords, tokens, or connection strings in source code. Use environment variables or a secrets manager (Vault, AWS Secrets Manager, etc.).
- [ ] **SQL injection prevention** — All database queries use parameterized statements or ORM methods. Never concatenate user input into SQL strings.
  ```sql
  -- Dangerous
  query = f"SELECT * FROM users WHERE id = '{user_id}'"

  -- Safe
  query = "SELECT * FROM users WHERE id = %s"
  cursor.execute(query, (user_id,))
  ```
- [ ] **XSS prevention** — All output is properly escaped. If rendering HTML, use a templating engine with auto-escaping. Never use `innerHTML` with user data.
- [ ] **CSRF protection** — State-changing endpoints require CSRF tokens or use SameSite cookies and proper Origin/Referer header checks.
- [ ] **Authentication is checked** — Every endpoint that requires authentication has an explicit check. No implicit trust based on routing.
- [ ] **Authorization is enforced** — Users can only access/modify resources they own or have explicit permission for. Check authorization at the service layer, not just the controller layer.
- [ ] **Rate limiting is applied** — Public endpoints have rate limits. Authentication endpoints have stricter limits to prevent brute force.
- [ ] **Input validation is strict** — Whitelist acceptable input patterns. Reject unexpected input with clear error messages.
- [ ] **Sensitive data is masked in logs** — Passwords, tokens, credit card numbers, SSNs, and PII are never logged. Use structured logging with field-level masking.
- [ ] **CORS is configured restrictively** — Only allow specific origins. Never use `Access-Control-Allow-Origin: *` in production.
- [ ] **File upload validation** — Validate file type by content (magic bytes), not just extension. Limit file size. Store uploads outside the web root.
- [ ] **Dependency vulnerability scanning** — Run `npm audit`, `pip-audit`, `cargo audit`, or equivalent before each deployment.

### Common Mistakes
- Trusting client-side validation as the only input validation
- Storing session tokens in localStorage (vulnerable to XSS)
- Forgetting to secure admin/debug endpoints in production

---

## Performance Checklist

- [ ] **Database queries are optimized** — No N+1 query patterns. Use eager loading, batch queries, or data loaders. Check query execution plans.
- [ ] **Appropriate caching strategy** — Identify hot paths and cache results. Define cache invalidation strategy. Use Redis/Memcached for distributed caching.
- [ ] **Connection pooling** — Database connections, HTTP clients, and other expensive resources use connection pools with appropriate limits.
- [ ] **Pagination is implemented** — List endpoints return paginated results. Never return unbounded result sets.
  ```
  # Bad: Returns 100,000 records
  GET /api/users

  # Good: Returns 50 records per page
  GET /api/users?page=1&per_page=50
  ```
- [ ] **Async processing for heavy work** — Long-running tasks (email sending, image processing, report generation) are offloaded to background workers/queues.
- [ ] **Response compression is enabled** — Gzip/Brotli compression for HTTP responses. Especially important for JSON and text payloads.
- [ ] **Memory usage is bounded** — No unbounded collections in memory. Streaming processing for large datasets. Memory profiling done for hot paths.
- [ ] **Timeout values are set** — HTTP client calls, database queries, and external service calls all have reasonable timeouts. No infinite waits.
- [ ] **Load testing is performed** — For critical paths, verify behavior under expected peak load. Know your breaking point.
- [ ] **Monitoring and alerting are in place** — Key metrics (latency, error rate, throughput, saturation) are tracked with appropriate alerts.

### Common Mistakes
- Adding Redis caching without a clear invalidation strategy
- Using `SELECT *` instead of selecting only needed columns
- Not setting connection pool sizes, leading to connection exhaustion under load

---

## Testing Checklist

- [ ] **Unit tests exist for business logic** — Core domain logic is tested in isolation with mocked dependencies. Aim for tests that are fast and deterministic.
- [ ] **Edge cases are tested** — Empty inputs, null values, boundary values, maximum/minimum values, Unicode strings, very long strings.
- [ ] **Error paths are tested** — Verify that errors are raised correctly, error messages are accurate, and error handling doesn't leak sensitive information.
- [ ] **Integration tests for critical flows** — End-to-end flows through the service layer, including database interactions and external service calls (using test doubles).
- [ ] **API contract tests exist** — Verify request/response schemas match the API documentation. Use tools like Pact for consumer-driven contracts.
- [ ] **Test data is managed** — Use fixtures, factories, or builders. Tests don't depend on shared mutable state. Each test sets up and tears down its own data.
- [ ] **Tests run in CI** — All tests execute automatically on every PR. Tests that are flaky are fixed or quarantined, not ignored.
- [ ] **Code coverage is measured** — Aim for high coverage on critical paths. Coverage is a guide, not a goal — 100% coverage doesn't mean bug-free code.
- [ ] **No test interdependence** — Tests can run in any order and in parallel without affecting each other. No shared database state between tests.
- [ ] **Performance regression tests** — Critical paths have baseline performance measurements. Automated alerts if performance degrades beyond threshold.

### Common Mistakes
- Writing tests that pass because of bugs in the test, not the code
- Testing implementation details instead of behavior
- Skipping tests for "obvious" code — that's where bugs hide

---

## Documentation Checklist

- [ ] **API documentation is complete** — Every endpoint documented with request/response examples, error codes, and authentication requirements.
- [ ] **Code comments explain "why", not "what"** — The code itself shows what it does. Comments explain business rules, non-obvious decisions, and workarounds.
- [ ] **README is up to date** — Setup instructions, environment variables, development workflow, and deployment steps are current.
- [ ] **Architecture decisions are recorded** — Significant design choices have ADRs (Architecture Decision Records) explaining the context, decision, and consequences.
- [ ] **Runbook exists for operations** — Common operational procedures (how to restart a service, how to handle a specific error, how to scale) are documented.
- [ ] **Data model is documented** — Database schema, entity relationships, and data flow diagrams are maintained and accessible.
- [ ] **Changelog is maintained** — Every user-facing change is recorded with version numbers following semver.

---

## Post-Development Checklist

- [ ] **All linting and formatting passes** — Run linter with zero warnings. Run formatter. No manual style overrides.
- [ ] **All tests pass locally** — Full test suite green before pushing. No skipped tests without a tracked issue.
- [ ] **Type checking passes** — TypeScript strict mode, mypy, or equivalent static analysis runs without errors.
- [ ] **Security scan passes** — Run SAST (static application security testing) tools. Review any new findings.
- [ ] **Performance benchmarks are acceptable** — Response times within SLA. No new slow queries. Memory usage within bounds.
- [ ] **Migration is backward compatible** — Database migrations can be applied without downtime. Deploy migration before the code that uses it.
- [ ] **Feature flags are configured** — If using feature flags, verify they're set to the correct initial state (usually disabled for new features).
- [ ] **Monitoring dashboards are updated** — New endpoints/features have corresponding dashboards and alerts.
- [ ] **PR is ready for review** — PR description explains what changed and why. Screenshots for UI changes. Migration steps called out.

---

## Cross-References

- See `security.md` for the full security audit checklist
- See `testing.md` for detailed testing procedures
- See `api.md` for API-specific development guidelines
- See `database.md` for database-specific guidelines
- See `deployment.md` for deployment procedures
- See `release.md` for release management
