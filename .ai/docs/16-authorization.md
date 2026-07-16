# 16 - Authorization

## Purpose

This document defines authorization patterns for the KMJ Optical ERP, including role-based access control, branch access control, resource-level permissions, middleware-based authorization, and the owner/staff/warehouse role hierarchy.

## Authorization Architecture

### Role Hierarchy

```
owner (admin)
  ├── Full system access
  ├── Can manage all users
  ├── Can manage all branches
  ├── Can access all branch data
  └── Can perform all operations

staff
  ├── Branch-scoped access only
  ├── Assigned to specific branch(es)
  ├── Can manage customers, orders, bills
  ├── Cannot manage users
  └── Cannot access other branches

warehouse
  ├── Warehouse-specific access
  ├── Can manage lens inventory
  ├── Can manage warehouse users
  ├── Owner can also access warehouse features
  └── No branch concept in warehouse app
```

### Authorization Layers

```
1. Authentication Layer (middleware/auth.ts)
   └── Verifies JWT token, attaches user to request

2. Role Layer (middleware/auth.ts - requireRole)
   └── Checks user role against allowed roles

3. Branch Layer (middleware/branch.ts - branchScope)
   └── Validates branch access and sets branch context

4. Controller Layer (controllers/*.ts)
   └── Business logic authorization checks

5. Frontend Layer (components/RoleGuard)
   └── UI element visibility based on role
```

## Middleware-Based Authorization

### Authentication Middleware

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

### Role Middleware

```typescript
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
```

### Usage in Routes

```typescript
// Owner-only endpoint
router.post("/recalculate/customer-totals",
  authenticate,
  requireRole("owner"),
  asyncHandler(handler)
);

// Owner or warehouse endpoint
router.get("/warehouse-users",
  authenticate,
  requireRole("owner", "warehouse"),
  asyncHandler(handler)
);
```

## Controller-Level Authorization

### Owner-Only Operations

```typescript
// Register new user (owner only)
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ... create user
}

// List all users (owner only)
export async function listUsers(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can list users");
  }
  // ... list users
}
```

### Owner/Warehouse Operations

```typescript
// List warehouse users (owner or warehouse)
export async function listWarehouseUsers(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || (authReq.user.role !== "owner" && authReq.user.role !== "warehouse")) {
    throw new AppError(403, "Access denied");
  }
  // ... list warehouse users
}

// Delete user (owner or warehouse, with restrictions)
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

### Self-Service Operations

```typescript
// Update own profile (any authenticated user)
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
  return res.json({ success: true, data: await formatUserWithBranches(user) });
}
```

## Branch Access Control

### Branch Scope Middleware

```typescript
// server/src/middleware/branch.ts
export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction) {
  const branchId = req.headers["x-branch-id"] as string || req.query._branch as string;

  if (branchId) {
    try {
      const branch = await Branch.findById(branchId).lean();
      if (branch && branch.isActive) {
        req.branchId = branch._id.toString();
        req.branchDb = branch.dbName;
        req.branchName = branch.name;
        const branchModels = getBranchModels(branch.dbName);
        req.branchModels = branchModels;

        const requestCtx: RequestContext = {
          branchId: req.branchId,
          branchName: req.branchName,
          branchModels,
        };

        ctx.run(requestCtx, () => next());
        return;
      }
    } catch (err) {
      console.error("Branch scope lookup failed:", err);
    }
  }
  next();
}
```

### Branch Access Rules

1. **Owner**: Can access any branch (no restriction)
2. **Staff**: Should only access assigned branches (not enforced in middleware)
3. **Warehouse**: No branch concept (separate app)

### Known Limitation

**Currently, there is no server-side enforcement of branch access per user.** Any authenticated user can send any `x-branch-id` header and access that branch's data. This is documented as a known security issue.

### Future Branch Access Control

```typescript
// Future implementation
export async function branchScope(req: BranchRequest, _res: Response, next: NextFunction) {
  const branchId = req.headers["x-branch-id"] as string;

  if (branchId) {
    const branch = await Branch.findById(branchId).lean();
    if (!branch || !branch.isActive) {
      throw new AppError(404, "Branch not found or inactive");
    }

    // Future: Check if user has access to this branch
    if (req.user?.role !== "owner") {
      const user = await User.findById(req.user?.sub).lean();
      if (!user?.branches?.includes(branch._id)) {
        throw new AppError(403, "You don't have access to this branch");
      }
    }

    // ... set up branch context
  }
}
```

## Resource-Level Permissions

### Customer Operations

| Operation | Owner | Staff | Warehouse |
|-----------|-------|-------|-----------|
| List customers | Yes | Yes (branch) | No |
| Create customer | Yes | Yes (branch) | No |
| View customer | Yes | Yes (branch) | No |
| Update customer | Yes | Yes (branch) | No |
| Delete customer | Yes | Yes (branch) | No |

### Order Operations

| Operation | Owner | Staff | Warehouse |
|-----------|-------|-------|-----------|
| List orders | Yes | Yes (branch) | No |
| Create order | Yes | Yes (branch) | No |
| Update order | Yes | Yes (branch) | No |
| Change status | Yes | Yes (branch) | No |
| Delete order | Yes | Yes (branch) | No |

### Bill Operations

| Operation | Owner | Staff | Warehouse |
|-----------|-------|-------|-----------|
| List bills | Yes | Yes (branch) | No |
| Create bill | Yes | Yes (branch) | No |
| Update bill | Yes | Yes (branch) | No |
| Delete bill | Yes | Yes (branch) | No |

### User Management

| Operation | Owner | Staff | Warehouse |
|-----------|-------|-------|-----------|
| List users | Yes (all) | No | Yes (warehouse only) |
| Create user | Yes | No | Yes (warehouse only) |
| Update user | Yes | No | Yes (warehouse only) |
| Delete user | Yes | No | Yes (warehouse only) |
| Update self | Yes | Yes | Yes |

### Inventory Operations

| Operation | Owner | Staff | Warehouse |
|-----------|-------|-------|-----------|
| List inventory | Yes | Yes (branch) | Yes (warehouse app) |
| Create item | Yes | Yes (branch) | Yes (warehouse app) |
| Update item | Yes | Yes (branch) | Yes (warehouse app) |
| Delete item | Yes | Yes (branch) | Yes (warehouse app) |
| Stock adjustment | Yes | Yes (branch) | Yes (warehouse app) |

## Frontend Authorization

### RoleGuard Component

The frontend uses a `RoleGuard` component to control UI visibility:

```tsx
// Client-side role check
<RoleGuard roles={["owner"]}>
  <Button onClick={deleteUser}>Delete User</Button>
</RoleGuard>

<RoleGuard roles={["owner", "warehouse"]}>
  <Button onClick={createWarehouseUser}>Create Warehouse User</Button>
</RoleGuard>
```

### Frontend Rules

1. **Always hide UI elements** that users cannot access
2. **Never rely on frontend-only checks** - always verify server-side
3. **Always show appropriate login pages** based on role
4. **Always redirect** unauthorized users to appropriate pages

## Permission Matrix

### Complete Permission Matrix

| Resource | Action | owner | staff | warehouse |
|----------|--------|-------|-------|-----------|
| Users | List | All | - | Warehouse |
| Users | Create | All | - | Warehouse |
| Users | Update | All | Self | All |
| Users | Delete | Non-admin | - | Warehouse only |
| Branches | List | Yes | - | - |
| Branches | Create | Yes | - | - |
| Branches | Update | Yes | - | - |
| Branches | Delete | Yes | - | - |
| Customers | CRUD | Yes | Branch | - |
| Visits | CRUD | Yes | Branch | - |
| Prescriptions | CRUD | Yes | Branch | - |
| Orders | CRUD | Yes | Branch | - |
| Bills | CRUD | Yes | Branch | - |
| Payments | CRUD | Yes | Branch | - |
| Inventory | CRUD | Yes | Branch | Warehouse |
| Delivery | Read | Yes | Branch | - |
| Settings | Read/Update | Yes | Branch | - |
| Dashboard | Read | Yes | Branch | - |
| Reports | Read | Yes | Branch | - |
| WhatsApp | Manage | Yes | Branch | - |
| Cache | Flush | Yes | - | - |
| Recalculate | Execute | Yes | - | - |

## Authorization Rules

### Golden Rules

1. **Never trust client-side authorization** - always verify server-side
2. **Always check roles** before sensitive operations
3. **Always check branch access** before branch-scoped data
4. **Never expose unauthorized data** in responses
5. **Always log authorization failures**
6. **Fail closed** - deny by default, allow by exception

### Error Responses

```typescript
// Authentication failure
res.status(401).json({ success: false, message: "Unauthorized" });

// Authorization failure
res.status(403).json({ success: false, message: "Forbidden" });

// Branch access failure
throw new AppError(403, "Access denied");

// Role check failure
throw new AppError(403, "Only admin can perform this action");
```

## Bad Examples

```typescript
// BAD: No authorization check
router.delete("/users/:id", authenticate, asyncHandler(handler));
// Any authenticated user can delete any user

// BAD: Client-side only authorization
<RoleGuard roles={["owner"]}>
  <AdminPanel />
</RoleGuard>
// No server-side check

// BAD: Trusting user-provided role
const role = req.body.role; // User could set themselves as owner
await User.create({ ...req.body, role });

// BAD: Exposing unauthorized data
const allUsers = await User.find(); // Returns password hashes
return res.json({ success: true, data: allUsers });

// BAD: No branch access check
const customers = await Customer.find(); // Accesses wrong branch
```

## Good Examples

```typescript
// GOOD: Proper authorization check
export async function register(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== "owner") {
    throw new AppError(403, "Only admin can create new users");
  }
  // ... proceed
}

// GOOD: Role middleware
router.post("/recalculate/customer-totals",
  authenticate,
  requireRole("owner"),
  asyncHandler(handler)
);

// GOOD: Excluding sensitive data
const user = await User.findById(id).select("-passwordHash").lean();

// GOOD: Branch-scoped query
const customers = await req.branchModels.Customer.find();

// GOOD: Conditional UI rendering
<RoleGuard roles={["owner"]}>
  <DeleteButton onClick={handleDelete} />
</RoleGuard>
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Role checks in controllers | Flexible per-endpoint logic | Scattered authorization logic |
| No branch access enforcement | Simpler implementation | Security vulnerability |
| Frontend RoleGuard | Better UX | Not a security measure |
| Same JWT for all roles | Simpler token management | Less granular control |
| Owner sees all branches | Better admin experience | Larger data exposure |

## Cross-References

- **Authentication**: See `docs/15-authentication.md`
- **RBAC**: See `docs/17-rbac.md`
- **Security**: See `docs/22-security.md`
- **API design**: See `docs/14-api-design.md`
- **Backend patterns**: See `docs/07-backend.md`

## AI Instructions

When working on authorization code:
1. Always check user roles before sensitive operations
2. Always verify server-side authorization (never trust client)
3. Always exclude sensitive data from responses
4. Always use appropriate HTTP status codes (401, 403)
5. Always log authorization failures
6. Never expose unauthorized data
7. Never skip authorization checks
8. Always run linting after changes
