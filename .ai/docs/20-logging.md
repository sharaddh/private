# 20 - Logging

## Purpose

This document defines logging standards for the KMJ Optical ERP, including structured logging, log levels, audit logging, console vs file logging, sensitive data handling, and log rotation.

## Logging Architecture

### Current Implementation

The KMJ ERP uses **Pino** for structured, JSON-based logging (`server/src/utils/logger.ts`). Pino provides high-throughput structured logs, automatic level filtering, and first-class request logging via `pino-http`. In development, logs are prettified with `pino-pretty`; in production they are emitted as JSON lines to stdout (suitable for aggregation by Render/Railway/logplex, etc.).

The logger wrapper exposes the same API used across the codebase:

```typescript
import logger from "../utils/logger";

logger.debug("debug detail");
logger.info("Server started", { port });
logger.warn("Redis unavailable, caching disabled");
logger.error("Unhandled error", { error: err.message });
logger.audit({ method, path, user, ip }); // audit trail entries
logger.child({ branchId });                // contextual child logger
```

`pino-http` request logging is mounted in `app.ts`. It logs every request with an `x-request-id` correlation ID and skips liveness/readiness probes (`/api/health`, `/api/ready`) and test environments to avoid noise.

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `debug` | Verbose detail, enabled via `LOG_LEVEL=debug` | Query shapes, internal state |
| `info` | Normal operational events | Startup, request summaries, job runs |
| `warn` | Recoverable problems | Missing config, Redis down, seed failures |
| `error` | Failures that need attention | Unhandled errors, connection failures |
| `audit` | Security/audit trail entries | Logins, mutations (via `logger.audit`) |

The level is controlled by `LOG_LEVEL` (default `info`).

### Startup Messages

```typescript
// server/src/index.ts
logger.info(`KMJ Optical ERP Server [${NODE_ENV}]`);
logger.info(`API: http://localhost:${PORT}/api`);
logger.info(`Client: http://localhost:${PORT}`);
logger.info(`Warehouse: http://localhost:${PORT}/warehouse`);
```

### Request Logging (pino-http)

Every HTTP request is logged as a structured JSON line:

```json
{
  "level": 30,
  "time": 1705312800000,
  "req": { "id": "req-1", "method": "POST", "url": "/api/orders", "remoteAddress": "1.2.3.4" },
  "res": { "statusCode": 201 },
  "responseTime": 24.3
}
```

Slow requests (over `SLOW_REQUEST_MS`, default 5000ms) are additionally logged at `warn` with `{ slow: true }`.

## Audit Logging

### Audit Middleware

```typescript
// server/src/middleware/audit.ts
export function audit(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") return next();

  const authReq = req as AuthRequest;
  const entry = {
    time: Date.now(),
    method: req.method,
    path: req.originalUrl,
    user: authReq.user ? { id: authReq.user.sub, username: authReq.user.username } : null,
    ip: req.ip,
  };

  logger.audit(entry);
  next();
}
```

### Audit Entry Format

```json
{
  "time": 1705312800000,
  "method": "POST",
  "path": "/api/orders",
  "user": { "id": "64f1a2b3c4d5e6f7a8b9c0d1", "username": "admin" },
  "ip": "127.0.0.1"
}
```

### Audit Rules

1. **Always include timestamp** (Unix milliseconds)
2. **Always include HTTP method** and path
3. **Always include user info** (if authenticated)
4. **Always include IP address**
5. **Never include request body** (may contain sensitive data)
6. **Never include response body**
7. **Disable in test environment**
8. **Use `logger.audit`** for audit entries so they are separable from app logs

### Audit Middleware Usage

```typescript
// Applied globally in app.ts
app.use(audit);

// Applied selectively on routes
router.post("/", authenticate, audit, asyncHandler(handler));
router.put("/:id", authenticate, audit, asyncHandler(handler));
router.delete("/:id", authenticate, audit, asyncHandler(handler));
```

## Error Logging

### Unhandled Errors

```typescript
// In error handler middleware (server/src/middleware/errorHandler.ts)
logger.error("Unhandled error", { error: err.message, stack: err.stack, path: req.originalUrl });
```

### Startup Errors

```typescript
logger.error("MongoDB connection failed", { error: err.message });
logger.error("Failed to start server", { error: err.message });
```

### Warning Logs

```typescript
logger.warn("Could not seed users", { error: e?.message });
logger.warn("Could not check/drop indexes", { error: e?.message });
logger.warn("Redis unavailable, using in-memory cache", { error: err.message });
```

## Sensitive Data Handling

### What NOT to Log

```typescript
// NEVER log passwords
logger.info({ password }, "user create"); // NEVER!

// NEVER log tokens
logger.info({ accessToken }, "login"); // NEVER!

// NEVER log full request bodies
logger.info({ body: req.body }, "request"); // May contain passwords, PII

// NEVER log customer PII in production
logger.info({ mobile: customer.mobile }, "customer"); // May be sensitive
```

### What TO Log

```typescript
// Safe: User ID (not PII)
logger.audit({ user: { id: user._id } });

// Safe: Non-sensitive operation info
logger.info(`Migrated ${docs.length} documents from ${collName}`);

// Safe: Status messages
logger.info("WhatsApp: order ready message queued");

// Safe: Error messages (no sensitive data)
logger.error("Unhandled error", { error: err.message });
```

### Data Masking

```typescript
// Mask phone numbers in logs
logger.info(`WhatsApp: message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
// Output: "WhatsApp: message queued for 10"
```

## Structured Logging

### Current Format

Pino emits JSON lines to stdout in production (level is a number, timestamp in ms):

```json
{
  "level": 30,
  "time": 1705312800000,
  "msg": "Order created",
  "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "orderId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

### Structured Logging Rules

1. **Always use JSON format** for machine-readable logs
2. **Always include timestamp** in ISO 8601 format
3. **Always include log level** (debug, info, warn, error)
4. **Always include message** describing the event
5. **Always include context** (user, resource IDs) as named fields
6. **Never include sensitive data** in context
7. **Never string-concatenate** sensitive or structured values into the message; pass them as fields

## Log Rotation

### Current State

Logs go to stdout/stderr (JSON in production, prettified in development). The platform (Render) captures stdout, so no file rotation is required. If self-hosting with file output, use a process supervisor or `pino-roll` for rotation.

## Environment-Specific Logging

### Development

```typescript
// Pretty-printed, human-readable output
transport: pino.transport({ target: "pino-pretty", options: { colorize: true } })
```

### Production

```typescript
// Raw JSON lines to stdout
transport: undefined // plain JSON output
```

### Test

```typescript
// Logging is suppressed in vitest (LOG_LEVEL from test env); pino-http is disabled in test
```

## Logging Best Practices

### Do

1. **Log at appropriate levels** (debug, info, warn, error, audit)
2. **Include context** (user, resource IDs) as structured fields
3. **Use consistent format** across the application
4. **Log errors with stack traces** (in development)
5. **Log security events** (auth failures, unauthorized access) via `logger.audit`
6. **Include request IDs** (`x-request-id`) for request correlation

### Don't

1. **Never log passwords** or authentication tokens
2. **Never log PII** (personally identifiable information) in production
3. **Never log request/response bodies** (may contain sensitive data)
4. **Never use console.log** for application logging (use the pino logger)
5. **Never log in loops** (performance impact)
6. **Never interpolate** sensitive values into message strings

## Bad Examples

```typescript
// BAD: Logging sensitive data
logger.info(`login ${username} ${password}`);

// BAD: Using console.log for application logs
console.log("Order created");

// BAD: No context in logs
logger.error("Error"); // No useful information

// BAD: Logging PII
logger.info(`Customer mobile: ${customer.mobile}`);

// BAD: Interpolating structured values into the message
logger.info(`order ${orderId} user ${userId}`); // Use fields instead
```

## Good Examples

```typescript
// GOOD: Structured log with context fields
logger.info("Order created", { orderId, userId });

// GOOD: Masked phone numbers
logger.info(`WhatsApp: message queued for ${customer.mobile?.slice(-2) || "unknown"}`);

// GOOD: Appropriate log levels
logger.info("Server started", { port: 4000 });
logger.warn("Redis not available, caching disabled");
logger.error("Unhandled error", { error: err.message });
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Pino structured logging | Machine-readable, queryable, fast | Requires field-based logging discipline |
| JSON in prod, pretty in dev | Best of both | Slight config complexity |
| stdout logging | Zero setup, platform-native | No on-box rotation (platform handles) |
| pino-http request logging | Request correlation via request IDs | Extra log volume |
| Audit via logger.audit | Separable audit trail | Extra log volume |
| Masked PII | Privacy protection | Less debugging info |

## Cross-References

- **Error handling**: See `docs/19-error-handling.md`
- **Security**: See `docs/22-security.md`
- **Backend patterns**: See `docs/07-backend.md`
- **Observability**: See `docs/38-observability.md`

## AI Instructions

When working on logging code:
1. Always use the pino logger from `server/src/utils/logger.ts` (never `console.log`)
2. Always use appropriate log levels (debug, info, warn, error, audit)
3. Always include context (user, resource IDs) as structured fields
4. Never log sensitive data (passwords, tokens, PII)
5. Always mask phone numbers in logs
6. Always disable audit logging in test environment
7. Never log in loops
8. Always run linting after changes
