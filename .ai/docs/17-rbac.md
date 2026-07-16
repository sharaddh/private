# 17 - Role-Based Access Control

## Purpose

This document defines the Role-Based Access Control (RBAC) system for the KMJ Optical ERP. It covers role definitions, permission matrices, route-level guards, component-level guards, and branch access control.

## Role Definitions

### Owner (Admin)

**Role String**: `"owner"`

**Authority Level**: Full system access

**Capabilities**:
- Manage all users (create, update, delete)
- Manage all branches (create, update, delete)
- Access all branch data
- Access dashboard, reports, settings
- Manage WhatsApp integration
- Flush cache
- Execute recalculate operations
- Access warehouse features

**Typical Users**: Shop owners, system administrators

### Staff

**Role String**: `"staff"`

**Authority Level**: Branch-scoped operational access

**Capabilities**:
- Manage customers (create, update, delete)
- Manage visits, prescriptions, orders
- Manage bills and payments
- View inventory
- Manage deliveries
- Access dashboard (branch-scoped)
- Access settings (branch-scoped)

**Limitations**:
- Cannot manage users
- Cannot manage branches
- Cannot access other branches
- Cannot flush cache
- Cannot execute recalculate

**Typical Users**: Shop staff, sales personnel

### Warehouse

**Role String**: `"warehouse"`

**Authority Level**: Warehouse-specific access

**Capabilities**:
- Manage lens inventory
- Manage warehouse users (create, update, delete)
- View warehouse dashboard
- Access warehouse-specific app (port 5174)

**Limitations**:
- No branch concept (separate app)
- Cannot access branch-scoped data
- Cannot manage branches
- Cannot access main ERP features

**Typical Users**: Warehouse staff, inventory managers

## Permission Matrix

### User Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List all users | Yes | No | Warehouse only |
| Create user | Yes | No | Warehouse only |
| Update any user | Yes | No | Warehouse only |
| Delete user | Yes (non-admin) | No | Warehouse only |
| Update self | Yes | Yes | Yes |
| Delete self | No | No | No |

### Branch Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List branches | Yes | No | No |
| Create branch | Yes | No | No |
| Update branch | Yes | No | No |
| Delete branch | Yes | No | No |
| Access any branch | Yes | No | No |

### Customer Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List customers | Yes | Yes (branch) | No |
| Create customer | Yes | Yes (branch) | No |
| View customer | Yes | Yes (branch) | No |
| Update customer | Yes | Yes (branch) | No |
| Delete customer | Yes | Yes (branch) | No |
| View summary | Yes | Yes (branch) | No |

### Visit Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List visits | Yes | Yes (branch) | No |
| Create visit | Yes | Yes (branch) | No |
| View visit | Yes | Yes (branch) | No |
| Update visit | Yes | Yes (branch) | No |
| Delete visit | Yes | Yes (branch) | No |

### Prescription Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List prescriptions | Yes | Yes (branch) | No |
| Create prescription | Yes | Yes (branch) | No |
| View prescription | Yes | Yes (branch) | No |
| Update prescription | Yes | Yes (branch) | No |
| Delete prescription | Yes | Yes (branch) | No |

### Order Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List orders | Yes | Yes (branch) | No |
| Create order | Yes | Yes (branch) | No |
| View order | Yes | Yes (branch) | No |
| Update order | Yes | Yes (branch) | No |
| Change status | Yes | Yes (branch) | No |
| Classify order | Yes | Yes (branch) | No |
| Review order | Yes | Yes (branch) | No |
| Delete order | Yes | Yes (branch) | No |
| Send demand | Yes | Yes (branch) | No |

### Bill Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List bills | Yes | Yes (branch) | No |
| Create bill | Yes | Yes (branch) | No |
| View bill | Yes | Yes (branch) | No |
| Update bill | Yes | Yes (branch) | No |
| Delete bill | Yes | Yes (branch) | No |
| Generate PDF | Yes | Yes (branch) | No |

### Payment Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List payments | Yes | Yes (branch) | No |
| Create payment | Yes | Yes (branch) | No |
| Update payment | Yes | Yes (branch) | No |
| Delete payment | Yes | Yes (branch) | No |

### Inventory Management

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| List inventory | Yes | Yes (branch) | Yes |
| Create item | Yes | Yes (branch) | Yes |
| View item | Yes | Yes (branch) | Yes |
| Update item | Yes | Yes (branch) | Yes |
| Delete item | Yes | Yes (branch) | Yes |
| Stock adjustment | Yes | Yes (branch) | Yes |
| View QR code | Yes | Yes (branch) | Yes |

### Dashboard & Reports

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| View dashboard | Yes | Yes (branch) | Yes (warehouse) |
| View revenue report | Yes | Yes (branch) | No |
| View monthly report | Yes | Yes (branch) | No |
| View customer report | Yes | Yes (branch) | No |
| View inventory report | Yes | Yes (branch) | No |
| View delivery report | Yes | Yes (branch) | No |

### System Operations

| Action | owner | staff | warehouse |
|--------|-------|-------|-----------|
| Flush cache | Yes | No | No |
| Recalculate totals | Yes | No | No |
| Manage WhatsApp | Yes | Yes (branch) | No |
| Access settings | Yes | Yes (branch) | No |

## Route-Level Guards

### Middleware-Based Guards

```typescript
// requireRole middleware
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
```

### Route Protection Examples

```typescript
// Owner-only routes
router.post("/recalculate/customer-totals",
  authenticate,
  requireRole("owner"),
  asyncHandler(handler)
);

// Owner or warehouse routes
router.get("/warehouse-users",
  authenticate,
  requireRole("owner", "warehouse"),
  asyncHandler(handler)
);

// Any authenticated user (branch-scoped)
router.get("/",
  authenticate,
  branchScope,
  cacheRoute(60),
  asyncHandler(handler)
);
```

### Controller-Level Guards

```typescript
// Owner-only in controller
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ...
}

// Owner or warehouse in controller
export async function deleteUser(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }
  // Additional checks...
}
```

## Component-Level Guards

### RoleGuard Component

```tsx
// Client-side role-based rendering
interface RoleGuardProps {
  roles: string[];
  children: React.ReactNode;
}

function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return null;
  }
  return <>{children}</>;
}

// Usage
<RoleGuard roles={["owner"]}>
  <Button onClick={deleteUser}>Delete User</Button>
</RoleGuard>

<RoleGuard roles={["owner", "warehouse"]}>
  <Button onClick={createWarehouseUser}>Create Warehouse User</Button>
</RoleGuard>
```

### Route Guards

```tsx
// Protected route wrapper
function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

// Usage in router
<Route path="/settings" element={
  <ProtectedRoute roles={["owner"]}>
    <Settings />
  </ProtectedRoute>
} />
```

## Branch Access Control

### Current Implementation

Branch access is determined by:
1. User's `branches` array in the User model
2. Owner users see all active branches
3. Staff users see only assigned branches
4. Branch ID sent via `x-branch-id` header

### Branch Assignment

```typescript
// When creating staff user
const userBranches = finalRole === "staff" && branchId ? [branchId] : [];

// When listing user's branches
async function formatUserWithBranches(user: any) {
  let branchList: any[] = [];
  if (user.role === "owner") {
    branchList = await Branch.find({ isActive: true }).select("name code dbName isActive").lean();
  } else if (user.branches && user.branches.length > 0) {
    branchList = await Branch.find({ _id: { $in: user.branches }, isActive: true })
      .select("name code dbName isActive").lean();
  }
  return { ...user, branches: branchList };
}
```

### Branch Access Rules

| Role | Branch Access |
|------|--------------|
| owner | All active branches |
| staff | Assigned branches only |
| warehouse | No branch concept |

## Authorization Flow

### Request Processing

```
HTTP Request
  │
  ▼
authenticate (Verify JWT)
  │
  ├── Invalid token → 401 Unauthorized
  │
  ▼
requireRole (Check role)
  │
  ├── Insufficient role → 403 Forbidden
  │
  ▼
branchScope (Validate branch)
  │
  ├── Invalid branch → 404 Not Found
  │
  ▼
Controller (Business logic checks)
  │
  ├── Authorization failure → 403 Forbidden
  │
  ▼
Response
```

### Example: Creating a User

```
1. Client sends POST /api/auth/register with JWT
2. authenticate middleware verifies JWT → attaches user to req
3. Controller checks: authReq.user.role === "owner"
4. If not owner → throw AppError(403, "Only admin can create new users")
5. If owner → proceed with user creation
```

### Example: Accessing Branch Data

```
1. Client sends GET /api/customers with JWT + x-branch-id header
2. authenticate middleware verifies JWT → attaches user to req
3. branchScope middleware validates branch exists and is active
4. branchScope sets req.branchModels to branch database models
5. Controller uses req.branchModels.Customer.find() → queries branch database
```

## Security Rules

### Golden Rules

1. **Never trust client-side checks** - always verify server-side
2. **Fail closed** - deny by default, allow by exception
3. **Principle of least privilege** - give minimum required access
4. **Separation of duties** - different roles for different operations
5. **Audit all authorization failures**

### Error Handling

```typescript
// Authentication failure (no token)
res.status(401).json({ success: false, message: "Unauthorized" });

// Authorization failure (wrong role)
res.status(403).json({ success: false, message: "Forbidden" });

// Branch access failure
throw new AppError(403, "Access denied");

// Specific role failure
throw new AppError(403, "Only admin can perform this action");
```

## Known Limitations

### Current Issues

1. **No server-side branch access enforcement** - Any user can access any branch
2. **Role checks scattered in controllers** - Not centralized
3. **No permission granularity** - Only role-level, not resource-level
4. **No audit trail for authorization failures**

### Future Improvements

1. **Add branch access validation** in branchScope middleware
2. **Create permission-based authorization** (not just role-based)
3. **Centralize authorization logic** in a dedicated service
4. **Add authorization audit logging**

## Bad Examples

```typescript
// BAD: No authorization check
router.delete("/users/:id", authenticate, asyncHandler(handler));
// Any authenticated user can delete any user

// BAD: Client-side only check
if (user.role !== "owner") return null; // No server verification

// BAD: Trusting client-provided role
const role = req.body.role; // User could set themselves as owner

// BAD: Overly permissive
router.get("/admin/users", authenticate, asyncHandler(handler));
// Missing role check

// BAD: Hardcoded role strings
if (req.user.role === "admin") { ... } // Should use constants
```

## Good Examples

```typescript
// GOOD: Middleware-based role check
router.post("/recalculate/customer-totals",
  authenticate,
  requireRole("owner"),
  asyncHandler(handler)
);

// GOOD: Controller-level authorization
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ...
}

// GOOD: Conditional UI rendering
<RoleGuard roles={["owner"]}>
  <AdminPanel />
</RoleGuard>

// GOOD: Role-based login routing
if (user.role === "staff") {
  navigate("/staff-dashboard");
} else if (user.role === "warehouse") {
  navigate("/warehouse");
} else {
  navigate("/dashboard");
}
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Role-based (not permission-based) | Simpler implementation | Less granular control |
| Controller-level checks | Flexible per-endpoint | Scattered logic |
| No branch access enforcement | Simpler implementation | Security vulnerability |
| Frontend RoleGuard | Better UX | Not a security measure |
| Role strings (not enums) | Flexible | Type-unsafe |

## Cross-References

- **Authentication**: See `docs/15-authentication.md`
- **Authorization**: See `docs/16-authorization.md`
- **Security**: See `docs/22-security.md`
- **API design**: See `docs/14-api-design.md`
- **Backend patterns**: See `docs/07-backend.md`

## AI Instructions

When working on RBAC code:
1. Always check user roles before sensitive operations
2. Always use requireRole middleware for route-level guards
3. Always add controller-level checks for business logic
4. Always use RoleGuard for frontend visibility
5. Never rely on client-side-only checks
6. Never trust client-provided roles
7. Always use appropriate HTTP status codes (401, 403)
8. Always log authorization failures
9. Always run linting after changes
