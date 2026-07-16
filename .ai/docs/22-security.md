# 22 - Security

## Purpose

This document defines security practices for the KMJ Optical ERP, including authentication, authorization, input validation, XSS prevention, CSRF prevention, rate limiting, CORS, helmet, secrets management, and audit logging.

## Security Architecture

### Security Layers

```
1. Network Layer
   ├── HTTPS (TLS)
   ├── CORS (Cross-Origin Resource Sharing)
   ├── Rate Limiting
   └── Helmet (HTTP headers)

2. Authentication Layer
   ├── JWT tokens
   ├── Password hashing (bcrypt)
   └── Token refresh

3. Authorization Layer
   ├── Role-based access control
   ├── Branch access control
   └── Resource-level permissions

4. Input Validation Layer
   ├── Zod schema validation
   ├── Manual validation
   ├── Sanitization
   └── Regex escaping

5. Data Protection Layer
   ├── Password hashing
   ├── Sensitive data exclusion
   └── Audit logging
```

## Network Security

### HTTPS

```typescript
// Production should use HTTPS
// Render.com provides HTTPS by default
// Local development uses HTTP (acceptable)
```

### Helmet

```typescript
// server/src/app.ts
app.use(helmet({
  contentSecurityPolicy: false,  // Disabled for SPA
  crossOriginEmbedderPolicy: false,
}));
```

### Helmet Rules

1. **Always use helmet** in production
2. **Disable CSP** for SPA (handled by CDN/proxy)
3. **Disable crossOriginEmbedderPolicy** for compatibility
4. **Never disable all helmet features**

### CORS

```typescript
app.use(cors({
  origin: [
    "https://kmjoptical.onrender.com",  // Production
    "http://localhost:5173",             // Dev client
    "http://localhost:4000",             // Dev server
    "http://localhost:5174",             // Dev warehouse
  ],
  credentials: true,
}));
```

### CORS Rules

1. **Always whitelist specific origins** (never use `*` in production)
2. **Enable credentials** for JWT cookies
3. **Allow custom headers** (`x-branch-id`)
4. **Allow standard methods** (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)
5. **Test CORS** with preflight requests

### Rate Limiting

```typescript
app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 200,              // 200 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
}));
```

### Rate Limiting Rules

1. **Global rate limit** on all `/api` routes
2. **200 requests per minute** per IP
3. **Return 429** when exceeded
4. **Use standard headers** for client awareness
5. **Consider stricter limits** for auth endpoints (future)

## Authentication Security

### Password Hashing

```typescript
import bcrypt from "bcrypt";

// Hash password (cost factor 10)
const passwordHash = await bcrypt.hash(password, 10);

// Compare password (constant-time)
const match = await bcrypt.compare(password, user.passwordHash);
```

### Password Rules

1. **Always use bcrypt** with cost factor 10
2. **Never store plaintext passwords**
3. **Never log passwords** or password hashes
4. **Always validate password exists** before hashing
5. **Always use `bcrypt.compare`** for verification

### JWT Security

```typescript
// Token generation
export function signAccess(payload: object) {
  return jwt.sign(payload, SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"]
  });
}

// Token verification
export function verifyToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
```

### JWT Rules

1. **Always use strong JWT_SECRET** (random, 32+ chars)
2. **Always set appropriate expiry** (24h for access, 7d for refresh)
3. **Never expose JWT_SECRET** in code or logs
4. **Always verify tokens** before processing
5. **Never store tokens** in cookies (use localStorage for SPA)

### Known JWT Issues

1. **Access and refresh tokens share the same secret** - Security risk
2. **No token revocation** - Compromised tokens remain valid until expiry
3. **No audience/issuer validation** - Tokens could be reused across services

## Authorization Security

### Role-Based Access

```typescript
// Owner-only operation
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ...
}
```

### Branch Access

```typescript
// Branch scope middleware
export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction) {
  const branchId = req.headers["x-branch-id"] as string;

  if (branchId) {
    const branch = await Branch.findById(branchId).lean();
    if (!branch || !branch.isActive) {
      throw new AppError(404, "Branch not found or inactive");
    }
    // ... set up branch context
  }
}
```

### Authorization Rules

1. **Always check roles** before sensitive operations
2. **Always verify server-side** (never trust client)
3. **Always exclude sensitive data** from responses
4. **Fail closed** (deny by default)
5. **Log authorization failures**

### Known Authorization Issues

1. **No server-side branch access enforcement** - Any user can access any branch
2. **Role checks scattered** in controllers (not centralized)
3. **No resource-level permissions** (only role-level)

## Input Validation Security

### Zod Validation

```typescript
const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(10, "Mobile must be at least 10 digits"),
  email: z.string().email("Invalid email").optional(),
});

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }
  // Use parsed.data (type-safe)
}));
```

### Regex Escaping

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Usage in search
const filter = { name: { $regex: escapeRegex(search), $options: "i" } };
```

### Validation Rules

1. **Always validate server-side** (never trust client)
2. **Always use Zod** for request body validation
3. **Always escape regex** in search queries
4. **Always sanitize string inputs** (trim, normalize)
5. **Always validate date formats**
6. **Never skip validation** for "trusted" inputs

## XSS Prevention

### Output Encoding

```typescript
// Server-side: Return JSON (auto-escaped by JSON serialization)
res.json({ success: true, data: customer });

// Client-side: React auto-escapes JSX
<div>{customer.name}</div>  // Auto-escaped
```

### Content Security Policy

```typescript
// Disabled for SPA (handled by CDN/proxy)
app.use(helmet({ contentSecurityPolicy: false }));
```

### XSS Rules

1. **Always use JSON responses** (auto-escaped)
2. **Always use React's JSX** (auto-escaped)
3. **Never use `dangerouslySetInnerHTML`** with user data
4. **Always validate and sanitize** user input
5. **Always escape regex** in search queries

## CSRF Prevention

### Current State

No CSRF protection is implemented. The API uses JWT tokens in Authorization headers, which are not vulnerable to CSRF.

### CSRF Rules

1. **JWT in Authorization header** is not vulnerable to CSRF
2. **Never store JWT in cookies** (prevents CSRF)
3. **Use SameSite=Strict** for any cookies (future)
4. **Validate Content-Type** for POST requests

## Secrets Management

### Environment Variables

```typescript
// server/src/config.ts
export const MONGO_URI = process.env.MONGO_URI || "";
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const REDIS_URL = process.env.REDIS_URL || "";
export const NODE_ENV = process.env.NODE_ENV || "development";
```

### Secrets Rules

1. **Never commit secrets** to version control
2. **Always use environment variables** for secrets
3. **Never log secrets** or configuration values
4. **Always validate required secrets** on startup
5. **Use strong, random values** for JWT_SECRET
6. **Rotate secrets** periodically

### Known Secret Issues

1. **Hardcoded default credentials** (`admin123`) - Should be randomized
2. **JWT_SECRET falls back to empty string** - Insecure in development
3. **No secret rotation** mechanism

## Data Protection

### Sensitive Data Exclusion

```typescript
// Always exclude passwordHash from responses
const user = await User.findById(id).select("-passwordHash").lean();

// Always exclude sensitive fields
const user = await User.findById(id)
  .select("-passwordHash -__v")
  .lean();
```

### Data Masking

```typescript
// Mask phone numbers in logs
console.log(`WhatsApp: message queued for ${customer.mobile?.slice(-2) || "unknown"}`);
```

### Data Protection Rules

1. **Never expose password hashes** in API responses
2. **Never log passwords** or tokens
3. **Always mask PII** in logs
4. **Never store plaintext passwords**
5. **Always use HTTPS** in production

## Audit Logging

### Audit Middleware

```typescript
export function audit(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") return next();

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

### Audit Rules

1. **Always log authentication attempts**
2. **Always log authorization failures**
3. **Always log sensitive operations** (user creation, deletion)
4. **Never log sensitive data** (passwords, tokens)
5. **Always include timestamp**, user, and IP

## Security Checklist

### Pre-Deployment Checklist

- [ ] HTTPS enabled
- [ ] CORS configured with specific origins
- [ ] Rate limiting enabled
- [ ] Helmet enabled
- [ ] JWT_SECRET set to strong random value
- [ ] No hardcoded credentials
- [ ] No secrets in version control
- [ ] Password hashing with bcrypt
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose internals
- [ ] Audit logging enabled

### Code Review Checklist

- [ ] No passwords in logs
- [ ] No tokens in logs
- [ ] No PII in logs
- [ ] Input validation present
- [ ] Authorization checks present
- [ ] Error handling present
- [ ] No hardcoded secrets
- [ ] No SQL/NoSQL injection vectors
- [ ] No XSS vulnerabilities

## Known Security Issues

### Critical

1. **JWT access and refresh tokens share same secret**
2. **No server-side branch access enforcement**
3. **Hardcoded default credentials** (`admin123`)

### Moderate

4. **No rate limiting on auth endpoints**
5. **No account lockout** for failed logins
6. **No token revocation** mechanism
7. **No HTTPS enforcement**

### Minor

8. **No Content-Security-Policy** (disabled for SPA)
9. **No X-Frame-Options** (could allow clickjacking)
10. **No request body size validation** for WhatsApp media

## Bad Examples

```typescript
// BAD: Logging sensitive data
console.log("Password:", password);
console.log("Token:", accessToken);

// BAD: Exposing internals
res.status(500).json({ error: err.stack });

// BAD: No input validation
const customer = await Customer.create(req.body);

// BAD: Trusting client
const role = req.body.role; // User could set themselves as owner

// BAD: Hardcoded secrets
const SECRET = "my-secret-key";

// BAD: Storing token in cookie
res.cookie("token", accessToken);
```

## Good Examples

```typescript
// GOOD: Proper password hashing
const passwordHash = await bcrypt.hash(password, 10);

// GOOD: Secure error responses
return res.status(500).json({ success: false, message: "Internal Server Error" });

// GOOD: Input validation
const parsed = createSchema.safeParse(req.body);
if (!parsed.success) {
  return res.json(fail(parsed.error.issues));
}

// GOOD: Role-based authorization
if (!authReq.user || authReq.user.role !== "owner") {
  throw new AppError(403, "Only admin can create new users");
}

// GOOD: Environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// GOOD: Token in Authorization header
headers["Authorization"] = `Bearer ${token}`;
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| JWT in localStorage | Works with SPA | XSS vulnerability |
| No CSRF protection | Simpler implementation | Not needed for JWT |
| bcrypt cost 10 | Good security/speed balance | Slower than lower cost |
| Global rate limit | Simple protection | No per-user differentiation |
| No account lockout | Simpler implementation | Brute force vulnerability |

## Cross-References

- **Authentication**: See `docs/15-authentication.md`
- **Authorization**: See `docs/16-authorization.md`
- **RBAC**: See `docs/17-rbac.md`
- **Validation**: See `docs/18-validation.md`
- **Error handling**: See `docs/19-error-handling.md`
- **Logging**: See `docs/20-logging.md`

## AI Instructions

When working on security code:
1. Always use bcrypt for password hashing
2. Always validate server-side (never trust client)
3. Never log sensitive data (passwords, tokens, PII)
4. Always use appropriate HTTP status codes
5. Always exclude sensitive data from responses
6. Always use environment variables for secrets
7. Always escape regex in search queries
8. Always run linting after changes
