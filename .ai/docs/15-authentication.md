# 15 - Authentication

## Purpose

This document defines the JWT authentication system for the KMJ Optical ERP. It covers token generation, verification, refresh tokens, login flows for admin/staff/warehouse, token storage, session management, and password hashing with bcrypt.

## Authentication Architecture

### Token System

| Token | Purpose | Expiry | Storage |
|-------|---------|--------|---------|
| Access Token | API authorization | 24h (configurable) | localStorage |
| Refresh Token | Token renewal | 7d (configurable) | localStorage |

### Login Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| POST `/api/auth/login` | Admin login | No |
| POST `/api/auth/staff-login` | Staff login | No |
| POST `/api/auth/warehouse-login` | Warehouse login | No |
| POST `/api/auth/refresh` | Refresh access token | No |
| POST `/api/auth/register` | Create user | Yes (owner) |
| POST `/api/auth/warehouse-register` | Create warehouse user | Yes (owner/warehouse) |
| GET `/api/auth/me` | Get current user | Yes |
| PUT `/api/auth/me` | Update profile | Yes |
| GET `/api/auth/users` | List all users | Yes (owner) |
| GET `/api/auth/warehouse-users` | List warehouse users | Yes (owner/warehouse) |
| PUT `/api/auth/users/:id` | Update user | Yes (owner/warehouse) |
| DELETE `/api/auth/users/:id` | Delete user | Yes (owner/warehouse) |

## JWT Token System

### Token Generation

```typescript
// server/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, NODE_ENV } from "../config";

const SECRET = JWT_SECRET || (NODE_ENV === "production" ? "" : "dev-secret-not-for-production");

export function signAccess(payload: object) {
  return jwt.sign(payload, SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"]
  });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"]
  });
}

export function verifyToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
```

### Token Payload

```typescript
interface JwtPayload {
  sub: string;       // User ID
  username: string;   // Username
  role?: string;      // "owner" | "staff" | "warehouse"
  branchId?: string;  // Optional branch assignment
}
```

### Configuration

```typescript
// server/src/config.ts
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
export const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
```

## Login Flows

### Admin Login

```typescript
export async function login(req: Request, res: Response) {
  const { username, password, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  // Staff cannot use admin login
  if (user.role === "staff") {
    throw new AppError(403, "Staff must use the staff login page");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const formatted = await formatUserWithBranches(user);
  const branches = formatted.branches || [];
  const selectedBranchId = branchId || (branches.length > 0 ? branches[0]._id?.toString() : null);

  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });

  return res.json({
    success: true,
    data: { user: formatted, access, refresh, branchId: selectedBranchId }
  });
}
```

### Staff Login

```typescript
export async function staffLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  // Only staff can use staff login
  if (user.role !== "staff") {
    throw new AppError(403, "Admins must use the admin login page");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const formatted = await formatUserWithBranches(user);
  const staffBranches = formatted.branches || [];

  if (staffBranches.length === 0) {
    throw new AppError(403, "Your account has not been assigned to any branch. Contact admin.");
  }

  // Auto-detect branch (staff should only have one)
  const branchId = staffBranches[0]._id?.toString();

  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });

  return res.json({
    success: true,
    data: { user: formatted, access, refresh, branchId }
  });
}
```

### Warehouse Login

```typescript
export async function warehouseLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const user = await User.findOne({ username }).lean();
  if (!user) {
    throw new AppError(400, "Invalid credentials");
  }

  // Only warehouse and owner can use warehouse login
  if (user.role !== "warehouse" && user.role !== "owner") {
    throw new AppError(403, "Access denied. Warehouse access requires a warehouse account.");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(400, "Invalid credentials");
  }

  const access = signAccess({ sub: user._id, username: user.username, role: user.role });
  const refresh = signRefresh({ sub: user._id });
  const formatted = await formatUserWithBranches(user);

  return res.json({
    success: true,
    data: { user: formatted, access, refresh }
  });
}
```

### Login Flow Rules

1. **Admin login** rejects staff users ("Staff must use the staff login page")
2. **Staff login** rejects non-staff users ("Admins must use the admin login page")
3. **Warehouse login** accepts warehouse and owner roles
4. **All logins** return `{ user, access, refresh }` on success
5. **Staff logins** auto-detect and return the branch ID
6. **Admin logins** auto-select the first available branch

## Token Refresh

### Refresh Flow

```typescript
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

### Client-Side Refresh

```typescript
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
```

### Automatic Retry on 401

```typescript
async function request<T>(path: string, init: RequestOptions = {}): Promise<ApiResponse<T>> {
  let res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && !path.includes("/auth/login")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      const newHeaders = {
        ...(init.headers as Record<string, string> || {}),
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return { success: false, message: "Session expired. Please login again." };
    }
  }

  // ... parse response
}
```

## Authentication Middleware

### Token Verification

```typescript
// server/src/middleware/auth.ts
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

### AuthRequest Interface

```typescript
export interface JwtPayload {
  sub: string;
  username: string;
  role?: string;
  branchId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
```

### Authentication Rules

1. **Always check `Authorization` header** for `Bearer ` prefix
2. **Always verify JWT signature** and expiration
3. **Always attach user payload** to `req.user`
4. **Always return 401** for invalid/missing tokens
5. **Never expose token details** in error messages
6. **Never skip authentication** without explicit reason

## Password Hashing

### Hashing with bcrypt

```typescript
import bcrypt from "bcrypt";

// Hash password (cost factor 10)
const passwordHash = await bcrypt.hash(password, 10);

// Compare password
const match = await bcrypt.compare(password, user.passwordHash);
```

### Password Rules

1. **Always use bcrypt** with cost factor 10
2. **Never store plaintext passwords**
3. **Never log passwords** or password hashes
4. **Always validate password exists** before hashing
5. **Always use `bcrypt.compare`** for verification (constant-time)

## User Registration

### Admin Registration (Owner Only)

```typescript
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }

  const { username, password, name, mobile, role, branchId } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const allowedRoles = ["staff", "warehouse"];
  const finalRole = allowedRoles.includes(role) ? role : "owner";

  // Staff users are auto-assigned to the selected branch
  const userBranches = finalRole === "staff" && branchId ? [branchId] : (req.body.branches || []);

  const user = await User.create({
    username, passwordHash,
    name: name || "", mobile: mobile || "",
    role: finalRole, branches: userBranches
  });

  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}
```

### Warehouse Registration

```typescript
export async function warehouseRegister(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Only admin or warehouse users can create warehouse accounts");
  }

  const { username, password, name, mobile } = req.body;
  if (!username?.trim() || !password?.trim()) {
    throw new AppError(400, "Username and password required");
  }

  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username, passwordHash,
    name: name || "", mobile: mobile || "",
    role: "warehouse"
  });

  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}
```

## User Management

### Profile Update

```typescript
export async function updateMe(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { name, mobile, password } = req.body;
  const update: Record<string, unknown> = {};

  if (name !== undefined) update.name = name;
  if (mobile !== undefined) update.mobile = mobile;
  if (password?.trim()) {
    update.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await User.findByIdAndUpdate(
    authReq.user?.sub,
    { $set: update },
    { new: true }
  ).select("-passwordHash").lean();

  if (!user) throw new AppError(404, "User not found");
  const data = await formatUserWithBranches(user);
  return res.json({ success: true, data });
}
```

### User Deletion

```typescript
export async function deleteUser(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }

  const target = await User.findById(req.params.id).lean();
  if (!target) throw new AppError(404, "User not found");

  // Warehouse users can only delete warehouse accounts
  if (target.role !== "warehouse" && authReq.user.role === "warehouse") {
    throw new AppError(403, "Warehouse users can only delete warehouse accounts");
  }

  // Cannot delete admin accounts
  if (target.role === "owner") throw new AppError(400, "Cannot delete admin account");

  // Cannot delete yourself
  if (target._id.toString() === authReq.user.sub) {
    throw new AppError(400, "Cannot delete yourself");
  }

  await User.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "User deleted" });
}
```

### Branch Formatting

```typescript
async function formatUserWithBranches(user: any) {
  let branchList: any[] = [];
  if (user.role === "owner") {
    // Owner always sees all active branches
    branchList = await Branch.find({ isActive: true })
      .select("name code dbName isActive").lean();
  } else if (user.branches && user.branches.length > 0) {
    branchList = await Branch.find({ _id: { $in: user.branches }, isActive: true })
      .select("name code dbName isActive").lean();
  }

  return {
    id: user._id,
    username: user.username,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    branches: branchList,
  };
}
```

## Route Registration

```typescript
// server/src/routes/auth.ts
router.post("/register", authenticate, asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/staff-login", asyncHandler(authController.staffLogin));
router.post("/warehouse-login", asyncHandler(authController.warehouseLogin));
router.post("/warehouse-register", authenticate, asyncHandler(authController.warehouseRegister));
router.post("/refresh", asyncHandler(authController.refresh));
router.get("/me", authenticate, asyncHandler(authController.me));
router.put("/me", authenticate, asyncHandler(authController.updateMe));
router.get("/users", authenticate, asyncHandler(authController.listUsers));
router.get("/warehouse-users", authenticate, asyncHandler(authController.listWarehouseUsers));
router.put("/users/:id", authenticate, asyncHandler(authController.updateUser));
router.delete("/users/:id", authenticate, asyncHandler(authController.deleteUser));
```

### Route Protection Rules

| Endpoint | Protection |
|----------|-----------|
| `/login`, `/staff-login`, `/warehouse-login`, `/refresh` | None (public) |
| `/register` | `authenticate` (owner only, checked in controller) |
| `/warehouse-register` | `authenticate` (owner/warehouse, checked in controller) |
| `/me`, `/me` (PUT) | `authenticate` |
| `/users` | `authenticate` (owner only, checked in controller) |
| `/users/:id` (PUT, DELETE) | `authenticate` (owner/warehouse, checked in controller) |

## Security Considerations

### Known Issues

1. **JWT access and refresh tokens share the same secret** - This is a security risk. In production, use separate secrets.
2. **Hardcoded default credentials** (`admin123`) - Should be randomized on first run.
3. **No rate limiting on auth endpoints** - Should add stricter limits for login attempts.
4. **No account lockout** - Failed login attempts don't lock accounts.

### Security Rules

1. **Always validate credentials** before issuing tokens
2. **Always hash passwords** with bcrypt (cost 10)
3. **Never expose password hashes** in API responses
4. **Always use HTTPS** in production
5. **Always set appropriate token expiry**
6. **Always validate refresh tokens** against database
7. **Never store tokens in cookies** (use localStorage for SPA)

## Bad Examples

```typescript
// BAD: Storing password in plaintext
const user = await User.create({ username, password });

// BAD: Comparing passwords with ===
if (password !== user.password) { ... }

// BAD: Exposing password hash in response
return res.json({ success: true, data: { ...user } });

// BAD: No role check on sensitive operations
router.delete("/users/:id", authenticate, asyncHandler(handler)); // Any user can delete

// BAD: Skipping authentication
router.get("/admin/users", asyncHandler(handler)); // No auth middleware

// BAD: Logging sensitive data
console.log("Login attempt:", { username, password });
```

## Good Examples

```typescript
// GOOD: Proper password hashing
const passwordHash = await bcrypt.hash(password, 10);

// GOOD: Secure password comparison
const match = await bcrypt.compare(password, user.passwordHash);

// GOOD: Excluding password from response
const user = await User.findById(id).select("-passwordHash").lean();

// GOOD: Role-based access check
if (!authReq.user || authReq.user.role !== "owner") {
  throw new AppError(403, "Only admin can perform this action");
}

// GOOD: Proper error messages (don't reveal if user exists)
if (!user || !match) {
  throw new AppError(400, "Invalid credentials");
}

// GOOD: Refresh token deduplication
if (refreshPromise) return refreshPromise;
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Same secret for access/refresh | Simpler implementation | Security risk if one is compromised |
| localStorage for tokens | Works with SPA | XSS vulnerability |
| No account lockout | Simpler implementation | Brute force vulnerability |
| bcrypt cost 10 | Good security/speed balance | Slower than lower cost |
| 24h access token | Longer sessions | Larger window for token theft |
| Role checks in controllers | Flexible per-endpoint logic | Scattered authorization logic |

## Cross-References

- **Authorization**: See `docs/16-authorization.md`
- **RBAC**: See `docs/17-rbac.md`
- **Security**: See `docs/22-security.md`
- **API design**: See `docs/14-api-design.md`
- **Backend patterns**: See `docs/07-backend.md`

## AI Instructions

When working on authentication code:
1. Always use bcrypt for password hashing (cost 10)
2. Always validate credentials before issuing tokens
3. Always exclude passwordHash from API responses
4. Always check user roles in controllers
5. Always use proper HTTP status codes (401, 403)
6. Never store plaintext passwords
7. Never log passwords or tokens
8. Never expose internal details in error messages
9. Always run linting after changes
