# API Development Checklist

> **Purpose:** Comprehensive checklist for designing, building, securing, and documenting APIs. Covers REST, GraphQL, and gRPC patterns.
> **AI Instructions:** Use this checklist when designing or implementing any API endpoint or contract. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed.

---

## Endpoint Design Checklist

- [ ] **RESTful conventions are followed** — Resources are nouns, not verbs. HTTP methods indicate action. URLs are hierarchical and predictable.
  ```
  # Good
  GET    /api/v1/users          (list users)
  GET    /api/v1/users/:id      (get user)
  POST   /api/v1/users          (create user)
  PUT    /api/v1/users/:id      (replace user)
  PATCH  /api/v1/users/:id      (update user)
  DELETE /api/v1/users/:id      (delete user)

  # Bad
  GET /api/v1/getUser
  POST /api/v1/createNewUser
  POST /api/v1/deleteUserById
  ```
- [ ] **URL versioning is implemented** — API version is in the URL path (`/api/v1/...`) or via `Accept` header. Version is present from day one.
- [ ] **Resource naming is consistent** — Plural nouns for collections (`/users` not `/user`). Consistent casing convention (kebab-case recommended).
- [ ] **Nested resources are limited** — Maximum 2 levels of nesting: `/users/:id/orders`. Deeper nesting is unwieldy — use query parameters instead.
- [ ] **Filtering, sorting, and pagination are standardized** — Use consistent query parameter patterns across all list endpoints.
  ```
  GET /api/v1/users?status=active&sort=-created_at&page=2&per_page=50
  GET /api/v1/users?search=john&fields=id,name,email
  ```
- [ ] **Batch/bulk endpoints exist** — For operations on multiple resources, provide batch endpoints to avoid N individual requests.
  ```
  POST /api/v1/users/batch
  Body: { "users": [{ "name": "Alice" }, { "name": "Bob" }] }
  ```
- [ ] **Idempotency keys are supported** — POST and PUT endpoints accept an `Idempotency-Key` header to prevent duplicate operations on retries.
- [ ] **Response envelope is consistent** — All responses follow the same structure for data, errors, and metadata.
  ```json
  {
    "data": { ... },
    "meta": { "page": 1, "per_page": 50, "total": 1200 },
    "errors": []
  }
  ```
- [ ] **HTTP status codes are used correctly** — 200 for success, 201 for created, 204 for no content, 400 for bad request, 401 for unauthorized, 403 for forbidden, 404 for not found, 409 for conflict, 422 for validation error, 429 for rate limited, 500 for server error.
- [ ] **HATEOAS links are included** — Responses include links to related resources for discoverability (at minimum, `self` and `next`/`prev` for collections).

### Common Mistakes
- Using verbs in URLs (`/getUser`, `/createOrder`)
- Inconsistent URL casing (`/Users` vs `/users` vs `/user-accounts`)
- Returning 200 for errors or 500 for client mistakes
- No versioning strategy from the start

---

## Validation Checklist

- [ ] **All input is validated at the API boundary** — Never trust client input. Validate type, format, range, and length before processing.
- [ ] **Schema validation is enforced** — Use JSON Schema, Joi, Zod, Pydantic, or equivalent for request body validation. Schemas are the source of truth.
- [ ] **Path and query parameters are validated** — IDs are validated as correct types. Query parameters are validated for expected values and types.
- [ ] **Required vs optional fields are explicit** — Document which fields are required. Use `required` in schemas. Reject requests missing required fields with specific error messages.
- [ ] **Nested object validation is complete** — Validate deeply nested objects, not just top-level fields. Use recursive schema validation.
- [ ] **Array validation is thorough** — Validate array item types, enforce min/max length, and handle empty arrays vs null arrays correctly.
- [ ] **File upload validation** — Validate file size, MIME type (by content, not just header), file name, and content. Scan for malware if applicable.
- [ ] **Date/time validation is strict** — Accept ISO 8601 format. Validate timezone handling. Reject ambiguous date formats.
- [ ] **Error messages are helpful** — Validation errors include the field name, the constraint violated, and the actual value received. Don't leak internal details.
  ```json
  {
    "errors": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address",
        "received": "not-an-email"
      }
    ]
  }
  ```
- [ ] **Sanitization is applied** — Strip or encode potentially dangerous characters. Trim whitespace. Normalize Unicode. Handle HTML in rich text fields safely.
- [ ] **Validation rules match between API and database** — Don't rely solely on database constraints for validation. Application-level validation provides better error messages.

### Common Mistakes
- Validating only the happy path and forgetting edge cases
- Returning cryptic database error messages to clients
- Different validation rules for the same field across endpoints
- Not validating file content, only file extension

---

## Authentication Checklist

- [ ] **Authentication mechanism is defined** — Choose and consistently apply one: JWT, OAuth 2.0, API keys, session cookies, or mTLS. Document the choice.
- [ ] **JWT best practices are followed** — Short expiry (15 min for access tokens). Refresh tokens with longer expiry. Tokens are signed with RS256 (not HS256 in production). Token payload doesn't contain sensitive data.
  ```
  # Access token
  {
    "sub": "user-123",
    "iss": "auth.example.com",
    "exp": 1700000060,    // 15 minutes
    "scope": "read write"
  }
  ```
- [ ] **Token refresh flow is implemented** — Clients can obtain new access tokens without re-authenticating. Refresh tokens are single-use and rotated.
- [ ] **API keys are secure** — API keys are random, high-entropy strings (at least 32 bytes). Keys can be revoked. Usage is logged and rate-limited.
- [ ] **Password handling is secure** — Passwords are hashed with bcrypt/argon2 (not MD5/SHA). Minimum password requirements are enforced. Passwords are never logged or returned in responses.
- [ ] **Multi-factor authentication is supported** — Critical operations (password change, email change, payment) can require MFA.
- [ ] **Session management is robust** — Sessions expire after inactivity. Sessions can be revoked. Concurrent session limits are enforced if needed.
- [ ] **Authentication errors are consistent** — Always return 401 for unauthenticated requests, never 403. Include `WWW-Authenticate` header with 401 responses.
- [ ] **Token storage guidance is documented** — For web apps, recommend httpOnly, Secure, SameSite cookies. For mobile apps, recommend secure storage (Keychain/Keystore). Never store in localStorage.

### Common Mistakes
- Using HS256 for JWT signing (allows token forgery if secret leaks)
- Not validating JWT signature or expiration
- Returning different error messages for invalid username vs invalid password (information leakage)
- Long-lived access tokens without refresh mechanism

---

## Authorization Checklist

- [ ] **Authorization is checked at every endpoint** — No endpoint is accessible without verifying the caller has permission. Don't rely on client-side route guards alone.
- [ ] **Role-based or attribute-based access control is implemented** — Define roles (admin, user, viewer) and permissions. Check permissions, not just roles, for fine-grained control.
- [ ] **Resource ownership is verified** — Users can only access/modify resources they own (or have explicit permission for). Check ownership at the service layer.
  ```
  # Bad: Only checks authentication
  GET /api/v1/orders/:id

  # Good: Checks authentication AND ownership
  GET /api/v1/orders/:id
  → Verify user owns this order OR is an admin
  ```
- [ ] **Admin endpoints are protected** — Admin routes require admin role. Admin role assignment is audited. Admin actions are logged.
- [ ] **CORS reflects authorization policy** — Allowed origins match the authorization model. Credentials are only sent to trusted origins.
- [ ] **Error messages don't leak authorization info** — Return 404 (not 403) when a resource exists but the user isn't authorized to see it. Don't reveal the resource's existence.
- [ ] **Service-to-service authorization is implemented** — Internal service calls use service accounts with minimal required permissions. No shared credentials between services.
- [ ] **Audit logging covers authorization decisions** — Log who accessed what, when, and whether it was allowed/denied. Critical for compliance and incident response.

### Common Mistakes
- Only checking authorization in the controller/route layer
- Returning 403 instead of 404 for unauthorized resource access (leaks information)
- Hardcoding admin checks instead of using a permission system
- Not revoking permissions immediately when a user's role changes

---

## Error Handling Checklist

- [ ] **Error response format is consistent** — Every error response follows the same structure across all endpoints.
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "The request body contains invalid fields",
      "details": [
        { "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email" }
      ],
      "request_id": "req_abc123",
      "documentation_url": "https://docs.example.com/errors/VALIDATION_ERROR"
    }
  }
  ```
- [ ] **Appropriate HTTP status codes are returned** — Errors use the correct status code. 4xx for client errors, 5xx for server errors. Don't return 200 for errors.
- [ ] **Internal errors are not exposed** — Stack traces, database errors, and internal service details are logged server-side but never returned to clients. Use generic messages for 500 errors.
- [ ] **Error codes are documented** — Every error code has a corresponding documentation page explaining what it means and how to resolve it.
- [ ] **Retry guidance is provided** — For transient errors (503, 429), include `Retry-After` header. For non-retryable errors, make that clear.
- [ ] **Request ID is included** — Every error includes a request/trace ID that correlates with server-side logs. Makes debugging support requests trivial.
- [ ] **Global error handler exists** — Unhandled exceptions are caught by a global handler that formats them consistently. No raw error messages leak to clients.
- [ ] **Timeout errors are handled gracefully** — When upstream services timeout, return a clear 504 or 503 with retry guidance. Don't let raw timeout errors reach clients.
- [ ] **Partial success is communicated** — For batch operations where some items succeed and some fail, return 207 (Multi-Status) with per-item results.

### Common Mistakes
- Returning raw database error messages (leaks schema and potentially data)
- Using 200 status code for all responses and putting error info in the body
- Not logging 5xx errors with enough context for debugging
- Inconsistent error formats across different API versions

---

## Caching Checklist

- [ ] **Cache-Control headers are set** — Define caching policy per endpoint. Use `no-cache`, `no-store`, `private`, or `public` appropriately.
  ```
  # Public data, cacheable for 1 hour
  Cache-Control: public, max-age=3600

  # User-specific data, not cacheable by CDNs
  Cache-Control: private, max-age=0, must-revalidate

  # Never cache
  Cache-Control: no-store
  ```
- [ ] **ETag headers are implemented** — Return `ETag` for responses. Support `If-None-Match` for conditional requests (304 Not Modified).
- [ ] **Last-Modified headers are set** — For resources with clear modification times, use `Last-Modified` and `If-Modified-Since`.
- [ ] **Cache invalidation strategy is defined** — Know how cached data becomes stale. Time-based expiry, event-based invalidation, or versioned cache keys.
- [ ] **Cache key design is thoughtful** — Include all relevant factors (user, locale, query params) in cache keys. Avoid overly broad cache keys that serve different data.
- [ ] **CDN caching is configured** — Static assets and cacheable API responses are served through a CDN. Cache rules are configured at the CDN level.
- [ ] **Negative caching is considered** — Cache "not found" responses briefly to prevent thundering herds on missing resources.
- [ ] **Cache stampede prevention** — Use locks or single-flight patterns to prevent multiple identical requests from simultaneously populating the same cache key.

### Common Mistakes
- Caching user-specific data without the `private` directive
- Not implementing cache invalidation (leads to stale data)
- Using `no-cache` when you mean `no-store` (they're different)
- Forgetting that POST responses are typically not cached

---

## Documentation Checklist

- [ ] **OpenAPI/Swagger spec is complete** — Every endpoint, parameter, response, and error is documented in the OpenAPI specification.
- [ ] **Request examples are provided** — Every endpoint has at least one request example with realistic data.
- [ ] **Response examples are provided** — Every status code has a response example, including error responses.
- [ ] **Authentication is documented** — How to obtain tokens, how to include them in requests, and token refresh flow are explained.
- [ ] **Rate limits are documented** — Limits per endpoint or globally, headers used (`X-RateLimit-*`), and how to handle 429 responses.
- [ ] **Pagination is documented** — How to navigate pages, what fields control pagination, and the format of pagination metadata.
- [ ] **Webhooks are documented** — Event types, payload schemas, retry behavior, and signature verification are explained.
- [ ] **Changelog is maintained** — Breaking changes, deprecations, and new features are documented per version with migration guides.
- [ ] **SDK/client library docs exist** — If providing client libraries, usage examples and installation instructions are available.
- [ ] **Postman collection or equivalent is available** — For quick testing, provide an importable API collection.

---

## Testing Checklist

- [ ] **Contract tests verify API shape** — Every endpoint's request/response schema is validated against the OpenAPI spec in tests.
- [ ] **Happy path tests exist** — Test successful operations for every endpoint with valid inputs.
- [ ] **Error path tests exist** — Test every error condition: invalid input, missing auth, forbidden, not found, conflict, rate limit.
- [ ] **Authentication tests exist** — Test unauthenticated access, expired tokens, invalid tokens, and insufficient permissions.
- [ ] **Validation tests are thorough** — Test boundary values, missing fields, wrong types, empty strings, null values, and extremely long inputs.
- [ ] **Pagination tests are correct** — Test first page, last page, middle pages, empty results, per_page limits, and total count accuracy.
- [ ] **Concurrency tests exist** — Test race conditions: simultaneous updates to the same resource, duplicate idempotency key submissions.
- [ ] **Performance tests establish baselines** — Measure response times for critical endpoints under expected load. Set thresholds for regression detection.
- [ ] **Load tests simulate realistic traffic** — Test with realistic request patterns, not just maximum throughput. Include think time between requests.
- [ ] **Integration tests verify external dependencies** — Test interactions with databases, caches, message queues, and third-party services using test doubles.

### Common Mistakes
- Testing only the happy path and ignoring error scenarios
- Not testing with different authentication levels
- Assuming mock behavior matches real external service behavior
- Not testing API versioning transitions

---

## Cross-References

- See `security.md` for comprehensive API security audit procedures
- See `backend.md` for server-side implementation guidelines
- See `testing.md` for general testing best practices
- See `database.md` for data layer considerations
- See `deployment.md` for API deployment and rollback procedures
