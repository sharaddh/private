# Security Patterns — KMJ Optical ERP

> Reference guide for all security-related conventions in the KMJ Optical ERP.

---

## 1. Authentication Middleware Patterns

**Purpose:** Verify JWT tokens on protected routes and attach user payload to the request.

**When to use:** Every route that requires a logged-in user.

### Authentication Middleware

```ts
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export interface JwtPayload {
  sub: string;
  username: string;
  role?: string;
  branchId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = header.split(" ")[1];
  try {
    const payload = verifyToken<JwtPayload>(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}
```

### Usage in Routes

```ts
// Protected route — requires valid JWT
router.get("/", authenticate, cacheRoute(60), asyncHandler(customerController.getAll));
router.post("/", authenticate, audit, asyncHandler(async (req, res) => { ... }));

// Public route — no authentication
router.post("/login", asyncHandler(authController.login));
router.post("/staff-login", asyncHandler(authController.staffLogin));
router.get("/active", asyncHandler(async (_req, res) => { ... }));
```

### Auth Header Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Client-Side Token Management

```ts
// client/src/api.ts
function buildHeaders(isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const branchId = getBranchId();
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}
```

### Anti-Pattern

```ts
// WRONG — no authentication on protected route
router.delete("/:id", asyncHandler(async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
}));

// WRONG — checking token manually in every route
router.get("/", asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
  const payload = jwt.verify(token, SECRET);
  // ... duplicate auth logic
}));
```

### Tradeoffs

- `authenticate` is always the first middleware in the chain — catches unauthenticated
  requests before any other processing.
- Returns 401 (Unauthorized) for missing/invalid tokens — distinct from 403 (Forbidden)
  used by `requireRole`.
- The `AuthRequest` interface extends Express `Request` — type-safe access to `req.user`.
- Token is stored in `localStorage` on the client — simple for a single-user ERP.

### Related Patterns

- JWT Token Patterns (section 5)
- Role Authorization (section 2)

---

## 2. Authorization Middleware Patterns

**Purpose:** Restrict access based on user role (owner, staff, warehouse).

**When to use:** Routes that should only be accessible to specific roles.

### requireRole Middleware

```ts
// server/src/middleware/auth.ts
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
```

### Inline Role Checks in Controllers

```ts
// server/src/controllers/authController.ts
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ...
}

export async function listUsers(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can list users");
  }
  // ...
}
```

### Client-Side Role Guard

```tsx
// client/src/components/RoleGuard.tsx
const staffPrefixes = [
  "/", "/customers", "/orders", "/bills", "/pickup", "/whatsapp", "/workspace",
];

function isStaffAllowed(path: string): boolean {
  return staffPrefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export default function RoleGuard({ children, path }: { children: React.ReactNode; path: string }) {
  const { isStaff, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  if (isStaff && !isStaffAllowed(path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

### Role-Based UI Visibility

```tsx
// client/src/pages/Customers.tsx
const { isStaff } = useAuth();

// Staff can't delete customers
{!isStaff && (
  <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}>
    <Trash2 size={13} />
  </button>
)}

// Staff can't see recalculate button
{!isStaff && (
  <button onClick={async () => { /* recalculate */ }}>
    Fix Data
  </button>
)}
```

### Layout Menu Filtering

```tsx
// client/src/components/Layout.tsx
const desktopMenu = allDesktopMenu.filter(m => !isStaff || m.staff);
const mobileNav = allMobileNav.filter(m => !isStaff || m.staff);
```

### Anti-Pattern

```ts
// WRONG — no server-side role check
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  // Any authenticated user (including staff) can delete
  await Customer.findByIdAndDelete(req.params.id);
}));

// WRONG — only client-side role check
<RoleGuard path="/settings">
  <Settings />
</RoleGuard>
// Server still accepts requests from staff users
```

### Tradeoffs

- Role checks happen on BOTH server and client — server is the source of truth, client
  is UX optimization.
- `requireRole` middleware is available but most routes use inline checks in controllers
  because the logic is intertwined with business rules.
- Three roles: `owner` (full access), `staff` (limited to core pages), `warehouse`
  (limited to warehouse operations).
- Staff users are auto-assigned to a single branch — can't switch branches.

### Related Patterns

- Authentication Middleware (section 1)
- JWT Token Patterns (section 5)

---

## 3. Input Validation Patterns (Zod)

**Purpose:** Validate and sanitize request body data before processing.

**When to use:** Every POST, PUT, and PATCH endpoint.

### Zod Schema Validation

```ts
// server/src/routes/orders.ts
const createSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  lens: z.string().optional(),
  coating: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: z.string(),
  collectPayment: z.number().optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "नकद", "कार्ड", "बैंक", "बीमा", "Insurance"]).optional(),
  advanceQuantity: z.number().optional(),
});
```

### Usage in Route Handler

```ts
router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createSchema.parse(req.body); // Throws ZodError → 400
  const customer = await Customer.findById(p.customerId).lean();
  if (!customer) throw new AppError(404, "Customer not found");
  const order = new Order(p as any);
  await order.save();
}));
```

### Manual Validation

```ts
// server/src/controllers/authController.ts
export async function register(req: Request, res: Response) {
  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  // ...
}
```

### Field Allowlisting

```ts
// server/src/routes/inventory.ts — only allow specific update fields
const allowed = ["brand", "model", "color", "size", "gender", "supplier",
  "quantity", "purchasePrice", "sellingPrice", "description", "category",
  "inventoryType", "location", "sku"];
const updates: Record<string, unknown> = {};
for (const key of allowed) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}

// server/src/routes/settings.ts
const allowedSettings = [
  "shopName", "shopPhone", "shopAddress", "gstin", "email", "invoicePrefix",
  "defaultDiscount", "taxRate", "currency", "timezone", "whatsappNumber",
  "orderMessage", "deliveryMessage", "receiptFooter", "theme"
];
```

### Enum Validation in Status Updates

```ts
// Inline enum validation (without Zod)
if (!["pending", "stock", "buy", "order"].includes(classification)) {
  return res.status(400).json({ success: false, message: "Invalid classification" });
}
if (!["right", "left"].includes(eye)) {
  return res.status(400).json({ success: false, message: 'eye must be "right" or "left"' });
}
```

### Anti-Pattern

```ts
// WRONG — passing req.body directly to database
const item = await Inventory.create(req.body);
// User could inject: { _id: "forged", __v: 999, role: "owner" }

// WRONG — validating after save
const item = await Inventory.create(req.body);
createSchema.parse(item); // Too late — bad data already saved
```

### Tradeoffs

- Zod `.parse()` throws `ZodError` which the global error handler formats as a 400 response.
- Manual validation is used for simpler checks (required fields, role checks).
- Allowlisting is safer than blacklisting — explicitly list what's allowed.
- `escapeRegex` is used on user-supplied regex patterns to prevent ReDoS attacks.

### Related Patterns

- Error Handling (backend-patterns.md)
- SQL/NoSQL Injection Prevention (this file, section 8)

---

## 4. Password Hashing Patterns

**Purpose:** Hash passwords with bcrypt before storage, compare on login.

**When to use:** User registration and login.

### Password Hashing on Registration

```ts
// server/src/controllers/authController.ts
import bcrypt from "bcrypt";

export async function register(req: Request, res: Response) {
  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }
  const passwordHash = await bcrypt.hash(password, 10); // Salt rounds: 10
  const user = await User.create({
    username,
    passwordHash,
    name: name || "",
    mobile: mobile || "",
    role: finalRole,
    branches: userBranches,
  });
  // ...
}
```

### Password Comparison on Login

```ts
export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }
  // Generate tokens...
}
```

### Password Update

```ts
export async function updateMe(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { name, mobile, password } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (mobile !== undefined) update.mobile = mobile;
  if (password?.trim()) {
    update.passwordHash = await bcrypt.hash(password, 10);
  }
  const user = await User.findByIdAndUpdate(authReq.user?.sub, { $set: update }, { new: true })
    .select("-passwordHash").lean();
  // ...
}
```

### Password Field Exclusion

```ts
// Always exclude passwordHash from responses
const user = await User.findById(id).select("-passwordHash").lean();

// List users — exclude passwords
const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
```

### Warehouse Password Registration

```ts
export async function warehouseRegister(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Only admin or warehouse users can create warehouse accounts");
  }
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: "warehouse" });
  // ...
}
```

### Anti-Pattern

```ts
// WRONG — storing plaintext password
const user = await User.create({ username, password }); // Password visible in database!

// WRONG — weak hashing
const passwordHash = await bcrypt.hash(password, 4); // Too few salt rounds

// WRONG — returning password in API response
res.json({ success: true, data: user }); // user.passwordHash is exposed
```

### Tradeoffs

- Salt rounds of 10 is the standard — fast enough for login, slow enough for brute force.
- "Invalid credentials" is returned for both wrong username and wrong password — prevents
  username enumeration.
- `passwordHash` is always excluded from responses via `.select("-passwordHash")`.
- Password update requires no current password confirmation — acceptable for a small team ERP.

### Related Patterns

- JWT Token Patterns (section 5)
- Authentication Controller (backend-patterns.md)

---

## 5. JWT Token Patterns

**Purpose:** Issue access and refresh tokens, verify tokens on requests, refresh expired
access tokens.

**When to use:** Authentication flow — login, token refresh, request verification.

### Token Configuration

```ts
// server/src/config.ts
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
export const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
```

### Token Generation

```ts
// server/src/utils/jwt.ts
import jwt from "jsonwebtoken";

const SECRET = JWT_SECRET || (NODE_ENV === "production" ? "" : "dev-secret-not-for-production");

export function signAccess(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}

export function verifyToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
```

### Token Payload

```ts
// Access token contains user info
const access = signAccess({ sub: user._id, username: user.username, role: user.role });

// Refresh token contains only user ID
const refresh = signRefresh({ sub: user._id });
```

### Login Response

```ts
return res.json({
  success: true,
  data: { user: formatted, access, refresh, branchId: selectedBranchId }
});
```

### Token Refresh Flow

```ts
// server/src/controllers/authController.ts
export async function refresh(req: Request, res: Response) {
  const { refresh: refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError(400, "Refresh token required");
  }
  const payload = jwt.verify(refreshToken, JWT_SECRET) as { sub: string };
  const user = await User.findById(payload.sub).lean();
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  return res.json({ success: true, data: { access } });
}
```

### Client-Side Auto-Refresh

```ts
// client/src/api.ts
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (data.success && data.data?.access) {
        localStorage.setItem("accessToken", data.data.access);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Auto-refresh on 401
async function request<T>(path: string, init: RequestOptions = {}): Promise<ApiResponse<T>> {
  let res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && !isLoginPath) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      const newHeaders = { ...init.headers, Authorization: `Bearer ${newToken}` };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      clearTokens();
      window.location.href = `/login?redirect=${returnUrl}`;
      return { success: false, message: "Session expired." };
    }
  }
  // ...
}
```

### Token Storage

```ts
// Client-side
localStorage.setItem("accessToken", token);
localStorage.setItem("refreshToken", refresh);
localStorage.setItem("currentBranchId", branchId);
```

### Anti-Pattern

```ts
// WRONG — same token for access and refresh
const token = jwt.sign({ sub: user._id }, SECRET, { expiresIn: "24h" });
// No refresh mechanism

// WRONG — no token expiry
const token = jwt.sign({ sub: user._id }, SECRET); // Never expires!

// WRONG — storing token in cookie without httpOnly
res.cookie("token", jwt.sign(...), { httpOnly: false }); // Accessible via JS
```

### Tradeoffs

- 24h access token + 7d refresh token is appropriate for a small-team ERP.
- Both tokens use the same secret — simpler but less secure than separate secrets.
- Refresh flow deduplicates concurrent attempts via `refreshPromise` — prevents
  multiple simultaneous refresh requests.
- On 401, the client redirects to login with a return URL — good UX.
- Tokens are stored in `localStorage` — simpler than cookies for a SPA.

### Related Patterns

- Authentication Middleware (section 1)
- Client-Side Auth (react-patterns.md)

---

## 6. Rate Limiting Patterns

**Purpose:** Prevent abuse and brute-force attacks via request rate limiting.

**When to use:** Applied globally to all routes.

### Global Rate Limit Configuration

```ts
// server/src/app.ts
import rateLimit from "express-rate-limit";

app.use(
  rateLimit({
    windowMs: 60 * 1000,  // 1-minute window
    max: 200,             // 200 requests per window per IP
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,  // Disable X-RateLimit-* headers
  })
);
```

### Response Headers

```
RateLimit-Limit: 200
RateLimit-Remaining: 195
RateLimit-Reset: 1721098825
```

### Rate Limited Response

```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```

### Anti-Pattern

```ts
// WRONG — no rate limiting
app.use("/api", routes);

// WRONG — too restrictive for normal ERP usage
app.use(rateLimit({ windowMs: 60000, max: 5 })); // 5 requests per minute

// WRONG — rate limiting login endpoint same as other routes
// Login should have stricter limits
app.use("/api/auth/login", rateLimit({ windowMs: 60000, max: 200 })); // Same as API
```

### Tradeoffs

- 200 requests/minute is generous enough for normal ERP usage (browsing, searching,
  creating records).
- `standardHeaders: true` provides rate limit info in response headers for monitoring.
- No per-route rate limits — the global limit is sufficient for a single-tenant ERP.
- Login endpoint could benefit from stricter limits (e.g., 10/minute) but is not
  currently implemented separately.

### Related Patterns

- CORS Patterns (section 7)
- Helmet Patterns (section 8)

---

## 7. CORS Patterns

**Purpose:** Control which origins can make cross-origin requests to the API.

**When to use:** Applied globally to all routes.

### CORS Configuration

```ts
// server/src/app.ts
import cors from "cors";

app.use(cors({
  origin: [
    "https://kmjoptical.onrender.com",  // Production
    "http://localhost:5173",             // Dev (Vite)
    "http://localhost:4000",             // Dev (API)
    "http://localhost:5174",             // Dev (alternate)
  ],
  credentials: true,  // Allow cookies/auth headers
}));
```

### Anti-Pattern

```ts
// WRONG — allowing all origins
app.use(cors({ origin: "*" })); // Any website can make API requests

// WRONG — no CORS at all
// Browser will block cross-origin requests from the frontend
```

### Tradeoffs

- Explicit origin list prevents unauthorized websites from making API requests.
- `credentials: true` allows the `Authorization` header to be sent cross-origin.
- Production origin (`kmjoptical.onrender.com`) is hardcoded — acceptable for a single
  deployment.
- Development origins cover Vite's default ports.

### Related Patterns

- Helmet Patterns (section 8)
- Rate Limiting (section 6)

---

## 8. Helmet Patterns

**Purpose:** Set security-related HTTP headers to protect against common vulnerabilities.

**When to use:** Applied globally to all routes.

### Helmet Configuration

```ts
// server/src/app.ts
import helmet from "helmet";

app.use(helmet({ contentSecurityPolicy: false }));
```

### Headers Set by Helmet

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-DNS-Prefetch-Control: off
```

### Content Security Policy Disabled

```ts
// CSP is disabled because the frontend is served from the same origin
// and may use inline scripts/styles from Vite
app.use(helmet({ contentSecurityPolicy: false }));
```

### Anti-Pattern

```ts
// WRONG — no helmet at all
// Missing security headers

// WRONG — too restrictive CSP breaks the frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // This would block Vite's inline scripts
    }
  }
}));
```

### Tradeoffs

- `contentSecurityPolicy: false` is necessary because Vite generates inline scripts
  during development and the ERP uses inline styles.
- Other Helmet protections (nosniff, DENY framing, HSTS) are still active.
- For a single-tenant ERP on Render.com, CSP is less critical than for a public website.

### Related Patterns

- CORS Patterns (section 7)
- Rate Limiting (section 6)

---

## 9. Audit Logging Patterns

**Purpose:** Track who performed what action for security forensics and debugging.

**When to use:** Applied to all mutation endpoints.

### Audit Middleware

```ts
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
  "time": 1721098765432,
  "method": "POST",
  "path": "/api/orders",
  "user": { "id": "507f1f77bcf86cd799439011", "username": "admin" },
  "ip": "192.168.1.100"
}
```

### Usage in Routes

```ts
// Mutations — audit enabled
router.post("/", authenticate, audit, asyncHandler(...));
router.put("/:id", authenticate, audit, asyncHandler(...));
router.delete("/:id", authenticate, audit, asyncHandler(...));

// Reads — no audit
router.get("/", authenticate, cacheRoute(60), asyncHandler(...));
router.get("/:id", authenticate, asyncHandler(...));
```

### Audit in Production

```ts
// In production, audit entries are logged but not stored
// Future: write to audit collection or external logging service
if (process.env.NODE_ENV !== "production") {
  console.log("AUDIT:", JSON.stringify(entry));
}
```

### Anti-Pattern

```ts
// WRONG — no audit on delete operations
router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  // No record of who deleted this order
}));

// WRONG — logging sensitive data in audit
const entry = {
  // ...
  body: req.body, // Could contain passwords, payment info
};
```

### Tradeoffs

- Audit is console.log only in development — structured logging is a future enhancement.
- In production, audit entries are currently not stored — this is a known limitation.
- Audit skips test mode to reduce test output noise.
- Records IP, user, method, and path — enough for debugging but not full compliance.
- Passwords and sensitive fields are never logged.

### Related Patterns

- Authentication Middleware (section 1)
- Security Best Practices (section 10)

---

## 10. Security Configuration Patterns

**Purpose:** Application-wide security configuration and best practices.

**When to use:** Application setup and deployment.

### Environment Variable Security

```ts
// server/src/config.ts
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const MONGO_URI = process.env.MONGO_URI || "";
export const REDIS_URL = process.env.REDIS_URL || "";

// Fail fast in production if secrets are missing
if (!JWT_SECRET && NODE_ENV === "production") {
  console.error("JWT_SECRET must be set in production");
  process.exit(1);
}
```

### .env Files (Not Committed)

```gitignore
# server/.gitignore
.env
.env.local
.env.production
```

### JSON Body Size Limit

```ts
// server/src/app.ts
app.use(express.json({ limit: "25mb" }));
```

### Static File Security

```ts
// Server-side rendered frontend with cache control
app.use(express.static(distPath, {
  maxAge: "1y",
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));
```

### API 404 Handling

```ts
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "API route not found" });
  }
  // Serve frontend for non-API routes
  res.sendFile(indexHtml);
});
```

### Request Size Validation

```ts
// Zod validation prevents oversized payloads at the application level
const createSchema = z.object({
  customerId: z.string().max(100), // Limit string length
  notes: z.string().max(5000),     // Limit text field
});
```

### Anti-Pattern

```ts
// WRONG — hardcoded secrets in source code
const JWT_SECRET = "my-super-secret-key-123"; // Exposed in git history

// WRONG — no body size limit
app.use(express.json()); // Default 100kb, but better to be explicit

// WRONG — .env committed to git
// server/.env contains MONGO_URI, JWT_SECRET, REDIS_URL
```

### Tradeoffs

- 25mb body limit accommodates base64-encoded PDF uploads and WhatsApp media.
- Static files are cached for 1 year (immutable) except HTML which is no-cache.
- JWT_SECRET is required in production — app crashes on startup without it.
- API 404 is handled separately from frontend routes — clean error messages.

### Related Patterns

- JWT Configuration (section 5)
- CORS Configuration (section 7)

---

## 11. Phone Number Normalization Patterns

**Purpose:** Normalize phone numbers to a consistent format for storage and WhatsApp
integration.

**When to use:** Any phone number input.

### Phone Normalization Utility

```ts
// server/src/utils/phone.ts
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits;
  return digits;
}

export function toWhatsAppJID(phone: string): string {
  return normalizePhone(phone) + "@s.whatsapp.net";
}
```

### Usage in Customer Creation

```ts
// server/src/controllers/customerController.ts
export async function create(req: Request, res: Response) {
  const { name, mobile } = req.body;
  if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
  const customer = await Customer.create({ ...req.body, mobile: mobile.trim() });
  // Note: Normalization happens at the WhatsApp service level, not on storage
}
```

### Usage in WhatsApp Sending

```ts
// Normalized before sending
const sent = await wa.sendMessage(normalizePhone(customer.mobile), msg);
```

### Client-Side Phone Input Restriction

```tsx
// client/src/components/Layout.tsx — only allow digits
<input value={drawerForm.mobile}
  onChange={(e) => setDrawerForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))}
  placeholder="Phone number" />
```

### Anti-Pattern

```ts
// WRONG — storing unformatted phone numbers
const customer = await Customer.create({ mobile: "(987) 654-3210" }); // Inconsistent format

// WRONG — no normalization before WhatsApp
await wa.sendMessage(customer.mobile, msg); // May fail with formatting characters
```

### Tradeoffs

- Phone numbers are stored as-is (user input) — normalization happens only when sending
  WhatsApp messages.
- Client-side input restriction (`replace(/\D/g, "")`) prevents non-numeric characters.
- `normalizePhone` handles 10-digit, 11-digit (with leading 0), and 12/13-digit (with
  country code) formats.
- `toWhatsAppJID` appends `@s.whatsapp.net` for Baileys API.

### Related Patterns

- Input Validation (section 3)
- WhatsApp Service (backend-patterns.md)

---

## 12. Environment Security Patterns

**Purpose:** Secure configuration management for development and production.

**When to use:** Application configuration.

### Environment Variables

```bash
# server/.env.example
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
REDIS_URL=redis://...
NODE_ENV=production
PORT=4000
```

### Production Checks

```ts
// server/src/config.ts
if (!JWT_SECRET && NODE_ENV === "production") {
  console.error("JWT_SECRET must be set in production");
  process.exit(1);
}

if (!JWT_SECRET && NODE_ENV !== "production") {
  console.warn("JWT_SECRET is not set — using empty string. Tokens will be insecure.");
}
```

### Gitignore for Secrets

```gitignore
# server/.gitignore
.env
.env.local
.env.production
.wwebjs_auth/
.wwebjs_cache/
```

### Render.com Deployment

```yaml
# render.yaml
services:
  - type: web
    name: kmj-erp
    envVars:
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: REDIS_URL
        sync: false
```

### Anti-Pattern

```ts
// WRONG — defaulting to empty string in production
const JWT_SECRET = process.env.JWT_SECRET || ""; // Tokens signed with empty string!

// WRONG — logging environment variables
console.log("Config:", { MONGO_URI, JWT_SECRET, REDIS_URL }); // Secrets in logs
```

### Tradeoffs

- `process.exit(1)` in production if JWT_SECRET is missing — fail fast rather than
  issue insecure tokens.
- Development mode uses a warning instead of crashing — allows local development
  without configuring all secrets.
- `.env` files are gitignored — secrets never enter version control.
- Render.com uses environment variables — not hardcoded in render.yaml.

### Related Patterns

- JWT Configuration (section 5)
- Authentication Flow (section 1)
