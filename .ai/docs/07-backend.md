# 07 - Backend

## Purpose

This document defines the backend architecture, patterns, and conventions for the KMJ Optical ERP Express.js server. Every backend change must follow these guidelines.

## Architecture Overview

### Server Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose ODM)
- **Cache**: Redis (optional, ioredis)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **WhatsApp**: Baileys
- **PDF**: PDFKit
- **QR**: qrcode

### Request Processing Pipeline

```
HTTP Request
  │
  ▼
Security Middleware (helmet, cors, compression)
  │
  ▼
Body Parsing (express.json, 25MB limit)
  │
  ▼
Logging (morgan)
  │
  ▼
Audit Logging (custom)
  │
  ▼
Rate Limiting (200 req/60s)
  │
  ▼
Route Matching
  │
  ▼
Route-Specific Middleware:
  ├── authenticate (JWT verification)
  ├── branchScope (branch routing)
  ├── cacheRoute (response caching)
  ├── requireRole (role-based access)
  └── audit (selective audit logging)
  │
  ▼
Route Handler (business logic)
  │
  ▼
Response Formatting
  │
  ▼
Cache Storage (if applicable)
  │
  ▼
HTTP Response
  │
  ▼
Error Handler (if error)
```

## Middleware Standards

### Authentication Middleware

**File**: `server/src/middleware/auth.ts`

**Responsibilities**:
- Extract JWT from `Authorization: Bearer <token>` header
- Verify JWT signature and expiration
- Attach user payload to `req.user`
- Reject invalid/expired tokens

**Implementation**:
```typescript
export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  req.user = decoded;
  next();
});
```

**Rules**:
- Always use `asyncHandler` wrapper
- Always throw `AppError` with status 401
- Never expose token details in error messages
- Always verify both signature and expiration

### Branch Scope Middleware

**File**: `server/src/middleware/branch.ts`

**Responsibilities**:
- Extract branch ID from `x-branch-id` header or `_branch` query parameter
- Validate branch exists and is active
- Create `BranchModels` instance for branch database
- Store in `AsyncLocalStorage` context
- Allow requests without branch ID to fall back to root database

**Implementation**:
```typescript
export const branchScope = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const branchId = req.headers['x-branch-id'] as string || req.query._branch as string;
  
  if (!branchId) {
    return next(); // Fall back to root database
  }

  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) {
    throw new AppError(404, 'Branch not found or inactive');
  }

  const branchModels = getBranchModels(branch.dbName);
  
  req.branchModels = branchModels;
  
  // Store in AsyncLocalStorage for model proxy
  ctx.run({ branchModels }, () => {
    next();
  });
});
```

**Rules**:
- Always validate branch exists and is active
- Always store in both `req.branchModels` and `AsyncLocalStorage`
- Allow requests without branch ID to proceed (root database fallback)
- Never expose branch database names in errors

### Cache Middleware

**File**: `server/src/middleware/cache.ts`

**Responsibilities**:
- Cache GET responses in Redis
- Set `x-cache: HIT/MISS` header
- Invalidate cache on mutations
- Branch-aware cache keys

**Implementation**:
```typescript
export const cacheRoute = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = getCacheKey(req);
    const cached = await redis.get(key);

    if (cached) {
      res.setHeader('x-cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

    // Intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode < 400) {
        redis.setex(key, ttlSeconds, JSON.stringify(body));
      }
      return originalJson(body);
    };

    res.setHeader('x-cache', 'MISS');
    next();
  };
};
```

**Rules**:
- Only cache GET requests
- Only cache successful responses (status < 400)
- Always set `x-cache` header
- Branch-aware cache keys
- Configurable TTL per route

### Error Handler Middleware

**File**: `server/src/middleware/errorHandler.ts`

**Responsibilities**:
- Catch all unhandled errors
- Format error responses consistently
- Log errors appropriately
- Never leak internal details

**Implementation**:
```typescript
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // AppError (business errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details
    });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // MongoDB duplicate key
  if ((err as any).code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry'
    });
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
};
```

**Rules**:
- Handle all error types
- Never expose internal details
- Always return consistent error format
- Always log unknown errors
- Always use appropriate HTTP status codes

## Route Standards

### Route File Structure

```typescript
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { branchScope } from '../middleware/branch';
import { cacheRoute } from '../middleware/cache';
import { asyncHandler } from '../middleware/asyncHandler';
import { success, created, fail, notFound } from '../utils/response';

import type { Request, Response } from 'express';

const router = Router();

// Validation schemas
const createSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(1)
});

// Routes
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req: Request, res: Response) => {
  const items = await req.branchModels.Customer.find();
  res.json(success(items));
}));

router.post('/', authenticate, branchScope, asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }
  const item = await req.branchModels.Customer.create(parsed.data);
  res.json(created(item));
}));

export default router;
```

### Route Handler Rules

1. **Always use `asyncHandler`** for async route handlers
2. **Always validate inputs** with Zod or manual checks
3. **Always use consistent response format** (`success()`, `created()`, `fail()`, `notFound()`)
4. **Always apply appropriate middleware** (authenticate, branchScope, cacheRoute, etc.)
5. **Always handle errors** with try/catch or asyncHandler
6. **Always invalidate cache** on mutations
7. **Never put business logic in routes** - delegate to controllers/services

### Route Naming

- **Plural nouns** for resource endpoints
- **camelCase** for query parameters
- **Nested resources** for related data

```typescript
// GOOD
GET    /api/customers           // List customers
POST   /api/customers           // Create customer
GET    /api/customers/:id       // Get customer
PUT    /api/customers/:id       // Update customer
DELETE /api/customers/:id       // Delete customer
GET    /api/customers/:id/visits // Get customer visits
```

## Model Standards

### Model File Structure

```typescript
import mongoose, { Schema, Document } from 'mongoose';

// Interface
export interface ICustomer extends Document {
  name: string;
  mobile: string;
  totalVisits: number;
  totalSpent: number;
  pendingAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Schema
const customerSchema = new Schema<ICustomer>({
  name: { type: String, required: true, index: true },
  mobile: { type: String, index: true },
  totalVisits: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0, index: { totalSpent: -1 } },
  pendingAmount: { type: Number, default: 0 }
}, { timestamps: true });

// Compound indexes
customerSchema.index({ customerId: 1 });
customerSchema.index({ createdAt: -1 });

// Export model
export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
```

### Model Rules

1. **Always define interfaces** for document shapes
2. **Always define indexes** for query patterns
3. **Always use compound indexes** for multi-field queries
4. **Always set defaults** for optional fields
5. **Always use `timestamps: true`** for automatic createdAt/updatedAt
6. **Never put business logic in models** - keep them focused on data

## Controller Standards

### Controller File Structure

```typescript
import { AppError } from '../utils/errors';
import { Customer } from '../models/customer';

export class CustomerController {
  async getCustomer(id: string) {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }
    return customer;
  }

  async createCustomer(data: CreateCustomerInput) {
    // Business rule: Validate customer doesn't exist
    const existing = await Customer.findOne({ mobile: data.mobile });
    if (existing) {
      throw new AppError(409, 'Customer with this mobile already exists');
    }

    return Customer.create(data);
  }
}
```

### Controller Rules

1. **Always use classes** for controllers
2. **Always validate business rules** before data operations
3. **Always throw AppError** for business errors
4. **Never handle HTTP concerns** - keep controllers pure
5. **Never format responses** - let routes handle that
6. **Always document business rules** in comments

## Service Standards

### Service File Structure

```typescript
import { redis } from '../config/redis';

export class CacheService {
  private prefix = 'route:';

  async get(key: string): Promise<string | null> {
    return redis.get(`${this.prefix}${key}`);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redis.setex(`${this.prefix}${key}`, ttlSeconds, value);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(`${this.prefix}${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export const cacheService = new CacheService();
```

### Service Rules

1. **Always use classes** for services
2. **Always export singleton instances** for stateful services
3. **Always handle external service failures** gracefully
4. **Never throw unhandled errors** - degrade gracefully
5. **Always document external dependencies** in comments

## Utility Standards

### Utility File Structure

```typescript
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface JwtPayload {
  sub: string;
  username: string;
  role?: string;
  branchId?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
```

### Utility Rules

1. **Always use named exports** for utilities
2. **Always define interfaces** for complex types
3. **Always handle errors** appropriately
4. **Never have side effects** - keep utilities pure
5. **Always document parameters** and return values

## Error Handling Standards

### AppError Class

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}
```

### Error Handling Rules

1. **Always use AppError** for business errors
2. **Always use appropriate HTTP status codes**
3. **Never expose internal details** in error messages
4. **Always log errors** appropriately
5. **Always return consistent error format**

## Async Handler Standards

### Implementation

```typescript
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Rules

1. **Always wrap async route handlers** with asyncHandler
2. **Never use try/catch** in route handlers (let asyncHandler handle it)
3. **Always forward errors** to error handler
4. **Never swallow errors** silently

## Performance Standards

### Database Query Rules

1. **Always use indexes** for query fields
2. **Always use projections** to limit returned fields
3. **Always use pagination** for list queries
4. **Always use `lean()`** for read-only queries
5. **Always use batch operations** instead of loops

### Caching Rules

1. **Always cache GET responses** with appropriate TTL
2. **Always invalidate cache** on mutations
3. **Always use branch-aware cache keys**
4. **Always handle cache failures** gracefully
5. **Never cache sensitive data**

## Security Standards

### Authentication Rules

1. **Always use HTTPS** in production
2. **Always validate JWT** signatures and expiration
3. **Never expose JWT secrets**
4. **Always use short-lived access tokens** (24h)
5. **Always use longer-lived refresh tokens** (7d)

### Authorization Rules

1. **Always check user roles** for protected endpoints
2. **Always check branch access** for branch-scoped data
3. **Never trust client-side permissions** - always verify server-side
4. **Always log authorization failures**
5. **Never expose unauthorized data**

### Input Validation Rules

1. **Always validate all inputs** with Zod or manual checks
2. **Always sanitize inputs** before processing
3. **Never trust client-side validation** - always validate server-side
4. **Always use parameterized queries** to prevent injection
5. **Always validate file uploads** for type and size

## Testing Standards

### Test File Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { connectDB, disconnectDB } from '../config/db';

describe('Customer API', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('GET /api/customers', () => {
    it('should return list of customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
```

### Test Rules

1. **Always test all endpoints** (GET, POST, PUT, DELETE)
2. **Always test error scenarios** (invalid input, unauthorized, not found)
3. **Always test edge cases** (empty data, large data, concurrent requests)
4. **Always clean up test data** after tests
5. **Always mock external services** (WhatsApp, Redis)

## Cross-References

- **API design**: See `docs/14-api-design.md`
- **Authentication**: See `docs/15-authentication.md`
- **Authorization**: See `docs/16-authorization.md`
- **Validation**: See `docs/18-validation.md`
- **Error handling**: See `docs/19-error-handling.md`
- **Caching**: See `docs/24-caching.md`
- **Security**: See `docs/22-security.md`
- **Performance**: See `docs/21-performance.md`

## AI Instructions

When working on backend code:
1. Follow these standards exactly
2. Always use asyncHandler for async handlers
3. Always validate inputs with Zod
4. Always use consistent response format
5. Always apply appropriate middleware
6. Always handle errors appropriately
7. Always document business rules
8. Never put business logic in routes
9. Never expose internal details in errors
10. Always run linting after changes
