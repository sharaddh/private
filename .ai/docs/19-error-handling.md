# 19 - Error Handling

## Purpose

This document defines error handling patterns for the KMJ Optical ERP, including the AppError class, asyncHandler, error handler middleware, error types, error responses, logging, and error recovery.

## Error Handling Architecture

### Error Flow

```
Route Handler
  │
  ├── Business Logic Error → throw AppError(statusCode, message)
  │
  ├── Validation Error → throw AppError(400, message)
  │
  ├── Database Error → Mongoose error → errorHandler middleware
  │
  └── Unexpected Error → catch → errorHandler middleware
       │
       ▼
  errorHandler middleware
       │
       ├── AppError → formatted response
       ├── ValidationError → 400 response
       ├── CastError → 400 response
       ├── DuplicateKey → 409 response
       └── Unknown → 500 response
```

## AppError Class

### Implementation

```typescript
// server/src/middleware/errorHandler.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

### Usage

```typescript
// Not found
throw new AppError(404, "Customer not found");

// Bad request
throw new AppError(400, "Username and password required");

// Forbidden
throw new AppError(403, "Only admin can create new users");

// Conflict
throw new AppError(409, "Username already exists");

// With details
throw new AppError(400, "Invalid input", { field: "name", reason: "required" });
```

### AppError Rules

1. **Always use AppError** for business logic errors
2. **Always include appropriate HTTP status code**
3. **Always include descriptive message**
4. **Never expose internal details** in messages
5. **Use details** for additional error context (optional)

## AsyncHandler

### Implementation

```typescript
// server/src/middleware/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### Usage

```typescript
// Wrap all async route handlers
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json({ success: true, data: customers });
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);
  res.json({ success: true, data: customer });
}));
```

### AsyncHandler Rules

1. **Always wrap async handlers** with asyncHandler
2. **Never use try/catch** in route handlers (let asyncHandler catch)
3. **Always forward errors** to error handler via `next()`
4. **Never swallow errors** silently

## Error Handler Middleware

### Implementation

```typescript
// server/src/middleware/errorHandler.ts
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // AppError (business errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details || {}),
    });
  }

  // Mongoose ValidationError
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // MongoDB duplicate key
  if ((err as any).code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry",
    });
  }

  // Unknown errors
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}
```

### Error Handler Rules

1. **Always handle all error types**
2. **Always return consistent error format**
3. **Never expose internal details** in production
4. **Always log unknown errors**
5. **Always use appropriate HTTP status codes**
6. **Must be last middleware** in the chain

## Error Types

### AppError (Business Errors)

```typescript
// Expected business logic errors
throw new AppError(400, "Username and password required");
throw new AppError(403, "Only admin can create new users");
throw new AppError(404, "Customer not found");
throw new AppError(409, "Username already exists");
```

### Mongoose ValidationError

```typescript
// Schema validation failures
if (err.name === "ValidationError") {
  return res.status(400).json({
    success: false,
    message: err.message,
  });
}
```

### Mongoose CastError

```typescript
// Invalid ObjectId format
if (err.name === "CastError") {
  return res.status(400).json({
    success: false,
    message: "Invalid ID format",
  });
}
```

### MongoDB DuplicateKey Error

```typescript
// Duplicate unique field
if ((err as any).code === 11000) {
  return res.status(409).json({
    success: false,
    message: "Duplicate entry",
  });
}
```

### SyntaxError (JSON Parse)

```typescript
// Invalid JSON in request body
if (err instanceof SyntaxError && "body" in err) {
  return res.status(400).json({
    success: false,
    message: "Invalid JSON",
  });
}
```

## Error Responses

### Success Response

```typescript
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```typescript
{
  "success": false,
  "message": "Customer not found"
}
```

### Validation Error Response

```typescript
{
  "success": false,
  "message": "Username and password required"
}
```

### Not Found Response

```typescript
{
  "success": false,
  message: "Customer not found"
}
```

### Conflict Response

```typescript
{
  "success": false,
  message: "Username already exists"
}
```

## Error Logging

### Console Logging

```typescript
// Known errors (expected)
console.log("WhatsApp: order ready message queued for ...");

// Warnings (unexpected but recoverable)
console.warn("Could not seed branch:", e?.message);

// Errors (unexpected, needs attention)
console.error("Unhandled error:", err);
console.error("Branch scope lookup failed:", err);
```

### Logging Rules

1. **Always log unhandled errors** in error handler
2. **Always log unexpected warnings** in startup
3. **Never log sensitive data** (passwords, tokens)
4. **Never log routine operations** (successful requests)
5. **Use appropriate log levels** (log, warn, error)

## Error Recovery

### Graceful Degradation

```typescript
// Redis cache failure - continue without cache
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected()) return null;
  try {
    const raw = await client!.get(prefixed(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// WhatsApp failure - continue without notification
(async () => {
  try {
    await wa.sendMedia(customer.mobile, pdfBuffer.toString("base64"), ...);
  } catch {
    // WhatsApp notification is optional
  }
})();
```

### Startup Recovery

```typescript
// MongoDB index cleanup (non-fatal)
try {
  const indexes = await customers.indexes();
  for (const idx of indexes) {
    if ((idx.key?.customerId || idx.key?.mobile) && idx.unique) {
      await customers.dropIndex(idx.name);
      console.log("Dropped stale unique index: " + idx.name);
    }
  }
} catch (e: any) {
  if (!e?.message?.includes?.("index not found")) {
    console.warn("Could not check/drop indexes:", e?.message);
  }
}
```

### Uncaught Exception Handling

```typescript
process.on("uncaughtException", async (err) => {
  const msg = err?.message || "";
  if (msg.includes("Unsupported state") || msg.includes("unable to authenticate data")) {
    console.error("WhatsApp: auth decryption failed, clearing stale sessions:", msg);
    try {
      const { whatsappManager } = await import("./services/whatsapp");
      await whatsappManager.clearAllStaleAuth();
    } catch {}
    // Restart WhatsApp after a short delay
    setTimeout(async () => {
      const { whatsappManager } = await import("./services/whatsapp");
      const branches = await Branch.find({ isActive: true }).lean();
      const branchKeys = branches.map((b) => (b as any)._id.toString());
      if (branchKeys.length > 0) {
        await whatsappManager.initAll(branchKeys).catch(() => {});
      }
    }, 2000);
    return;
  }
  console.error("Unhandled exception:", err);
  process.exit(1);
});
```

## Route-Level Error Handling

### Inline Try/Catch (Alternative to asyncHandler)

```typescript
// Some routes use inline try/catch for complex logic
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status, collectPayment, paymentMode, advanceQuantity } = statusUpdateSchema.parse(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    // ... complex business logic
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
```

### Error Handler Middleware Placement

```typescript
// server/src/app.ts
app.use("/api", routes);
// ... static files ...
app.use(errorHandler); // MUST be last
```

## Bad Examples

```typescript
// BAD: Swallowing errors
router.get("/", asyncHandler(async (req, res) => {
  try {
    const data = await Customer.find();
    res.json({ success: true, data });
  } catch (err) {
    // Error is swallowed!
  }
}));

// BAD: Exposing internal details
res.status(500).json({ error: err.stack });

// BAD: Inconsistent error format
res.status(400).json({ error: "bad request" });
res.status(400).json({ success: false, msg: "invalid" });

// BAD: Not using asyncHandler
router.get("/", async (req, res) => {
  const data = await Customer.find(); // Unhandled rejection!
  res.json({ success: true, data });
});

// BAD: Logging sensitive data
console.log("Login failed:", { username, password });
```

## Good Examples

```typescript
// GOOD: Proper error throwing
throw new AppError(404, "Customer not found");

// GOOD: Consistent error responses
return res.status(404).json({ success: false, message: "Not found" });

// GOOD: AsyncHandler wrapping
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json({ success: true, data: customers });
}));

// GOOD: Graceful degradation
try {
  await wa.sendMedia(phone, data);
} catch {
  // WhatsApp is optional, continue
}

// GOOD: Proper logging
console.error("Unhandled error:", err);
console.warn("Could not seed branch:", e?.message);
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| AppError class | Consistent error creation | Extra class to maintain |
| asyncHandler | Cleaner route handlers | Less explicit error handling |
| Generic error messages | No information leakage | Harder to debug |
| Inline try/catch | More control | More verbose |
| Console logging | Simple | No log rotation, no structure |

## Cross-References

- **Backend patterns**: See `docs/07-backend.md`
- **Express patterns**: See `docs/11-express.md`
- **Validation**: See `docs/18-validation.md`
- **Logging**: See `docs/20-logging.md`
- **Security**: See `docs/22-security.md`

## AI Instructions

When working on error handling code:
1. Always use AppError for business logic errors
2. Always wrap async handlers with asyncHandler
3. Always return consistent error format
4. Always use appropriate HTTP status codes
5. Never expose internal details in error messages
6. Always log unhandled errors
7. Always handle errors gracefully
8. Always run linting after changes
