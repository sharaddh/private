# 20 - Logging

## Purpose

This document defines logging standards for the KMJ Optical ERP, including structured logging, log levels, audit logging, console vs file logging, sensitive data handling, and log rotation.

## Logging Architecture

### Current Implementation

The KMJ ERP uses `console.log`, `console.warn`, and `console.error` for logging. There is no structured logging library (e.g., Winston, Pino) currently in use.

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `console.log` | Informational messages | Startup messages, audit entries |
| `console.warn` | Warnings (recoverable) | Missing config, seed failures |
| `console.error` | Errors (needs attention) | Unhandled errors, connection failures |

## Console Logging

### Startup Messages

```typescript
// server/src/index.ts
console.log(`\n  KMJ Optical ERP Server [${NODE_ENV}]`);
console.log(`  API:        http://localhost:${PORT}/api`);
console.log(`  Client:     http://localhost:${PORT}`);
console.log(`  Warehouse:  http://localhost:${PORT}/warehouse\n`);
```

### User Seeding

```typescript
console.log("  Default users created:");
console.log("    Owner:     admin / ********");
console.log("    Warehouse: warehouse / ********");
```

### Branch Seeding

```typescript
console.log(`  Default branch created: ${branch.name} (${branch.code})`);
console.log(`    Migrated ${docs.length} documents from ${collName}`);
```

### Redis Status

```typescript
client.on("ready", () => { console.log("Redis ready for cache operations"); });
```

### WhatsApp Status

```typescript
console.log(`WhatsApp: initializing for ${branchKeys.length} branch(es)...`);
console.log(`WhatsApp: order ready message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
```

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

  if (process.env.NODE_ENV !== "production") {
    console.log("AUDIT:", JSON.stringify(entry));
  }

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
8. **Only log in non-production** (current implementation)

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
// In error handler middleware
console.error("Unhandled error:", err);
```

### Startup Errors

```typescript
console.error("MongoDB connection failed:", err);
console.error("MONGO_URI not set");
console.error("Failed to start server:", err);
```

### Warning Logs

```typescript
console.warn("Could not seed users:", e?.message);
console.warn("Could not seed branch:", e?.message);
console.warn("Could not check/drop indexes:", e?.message);
console.warn("Redis:", err.message);
```

### WhatsApp Errors

```typescript
console.error("WhatsApp init failed:", e);
console.error("WhatsApp: auth decryption failed, clearing stale sessions:", msg);
console.error(`Demand PDF sendMedia threw: ${e.message}`);
```

## Sensitive Data Handling

### What NOT to Log

```typescript
// NEVER log passwords
console.log("Password:", password); // NEVER!

// NEVER log tokens
console.log("Access token:", accessToken); // NEVER!

// NEVER log full request bodies
console.log("Request body:", req.body); // May contain passwords, PII

// NEVER log customer PII in production
console.log("Customer:", customer.mobile); // May be sensitive
```

### What TO Log

```typescript
// Safe: User ID (not PII)
console.log("AUDIT:", JSON.stringify({ user: { id: user._id } }));

// Safe: Non-sensitive operation info
console.log(`Migrated ${docs.length} documents from ${collName}`);

// Safe: Status messages
console.log("WhatsApp: order ready message queued");

// Safe: Error messages (no sensitive data)
console.error("Unhandled error:", err.message);
```

### Data Masking

```typescript
// Mask phone numbers in logs
console.log(`WhatsApp: message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
// Output: "WhatsApp: message queued for 10"

// Mask bill numbers
console.log(`Bill ${bill.billNumber} created`);
// Output: "Bill BILL-1705312800000 created" (billNumber is not PII)
```

## Structured Logging

### Current Format

```
AUDIT: {"time":1705312800000,"method":"POST","path":"/api/orders","user":{"id":"...","username":"admin"},"ip":"127.0.0.1"}
```

### Desired Format (Future)

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "message": "Order created",
  "context": {
    "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "username": "admin",
    "orderId": "64f1a2b3c4d5e6f7a8b9c0d2",
    "customerId": "64f1a2b3c4d5e6f7a8b9c0d3"
  }
}
```

### Structured Logging Rules

1. **Always use JSON format** for machine-readable logs
2. **Always include timestamp** in ISO 8601 format
3. **Always include log level** (info, warn, error)
4. **Always include message** describing the event
5. **Always include context** (user, resource IDs)
6. **Never include sensitive data** in context

## Log Rotation

### Current State

No log rotation is implemented. Console output goes to stdout/stderr.

### Recommended Setup

```typescript
// Future: Use Winston or Pino with rotation
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const transport = new DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [transport],
});
```

### Rotation Rules

1. **Rotate daily** for production
2. **Keep 14 days** of logs
3. **Limit file size** to 20MB
4. **Compress old logs** (gzip)
5. **Store logs outside** web root
6. **Never store logs** in database

## Environment-Specific Logging

### Development

```typescript
// Verbose logging in development
if (process.env.NODE_ENV !== "production") {
  console.log("AUDIT:", JSON.stringify(entry));
}
```

### Production

```typescript
// Minimal logging in production
if (process.env.NODE_ENV === "test") return next(); // Skip in test
// Only log errors in production
```

### Test

```typescript
// Suppress logging in tests
if (process.env.NODE_ENV === "test") return next();
```

## Logging Best Practices

### Do

1. **Log at appropriate levels** (info, warn, error)
2. **Include context** (user, resource IDs)
3. **Use consistent format** across the application
4. **Log errors with stack traces** (in development)
5. **Log security events** (auth failures, unauthorized access)

### Don't

1. **Never log passwords** or authentication tokens
2. **Never log PII** (personally identifiable information) in production
3. **Never log request/response bodies** (may contain sensitive data)
4. **Never use console.log** for errors (use console.error)
5. **Never log in loops** (performance impact)

## Bad Examples

```typescript
// BAD: Logging sensitive data
console.log("Login:", { username, password });
console.log("Token:", accessToken);
console.log("Request body:", req.body);

// BAD: Logging in production
console.log("AUDIT:", JSON.stringify(entry)); // Only in dev

// BAD: Using console.log for errors
console.log("Error occurred:", err); // Should be console.error

// BAD: No context in logs
console.error("Error"); // No useful information

// BAD: Logging PII
console.log("Customer mobile:", customer.mobile);
```

## Good Examples

```typescript
// GOOD: Structured audit log
const entry = {
  time: Date.now(),
  method: req.method,
  path: req.originalUrl,
  user: authReq.user ? { id: authReq.user.sub, username: authReq.user.username } : null,
  ip: req.ip,
};
console.log("AUDIT:", JSON.stringify(entry));

// GOOD: Masked phone numbers
console.log(`WhatsApp: message queued for ${customer.mobile?.slice(-2) || "unknown"}`);

// GOOD: Appropriate log levels
console.log("Server started on port 4000");
console.warn("Redis not available, caching disabled");
console.error("Unhandled error:", err);

// GOOD: Conditional logging
if (process.env.NODE_ENV !== "production") {
  console.log("AUDIT:", JSON.stringify(entry));
}
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Console logging | Simple, no dependencies | No rotation, no structure |
| No structured logging | Less code | Harder to query/analyze |
| Conditional audit logging | Less noise in prod | Missing audit trail in prod |
| No log rotation | Simpler setup | Disk space issues |
| Masked PII | Privacy protection | Less debugging info |

## Cross-References

- **Error handling**: See `docs/19-error-handling.md`
- **Security**: See `docs/22-security.md`
- **Backend patterns**: See `docs/07-backend.md`

## AI Instructions

When working on logging code:
1. Always use appropriate log levels (log, warn, error)
2. Always include context (user, resource IDs)
3. Never log sensitive data (passwords, tokens, PII)
4. Always mask phone numbers in logs
5. Always disable audit logging in test environment
6. Always use console.error for errors
7. Never log in loops
8. Always run linting after changes
