# 11 - Express.js

## Purpose

This document defines Express.js-specific patterns, conventions, and best practices for the KMJ Optical ERP backend. It covers routing, middleware, request handling, and response formatting.

## Application Setup

### App Configuration

```typescript
// app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { audit } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://kmjoptical.onrender.com',
    'http://localhost:5173',
    'http://localhost:4000',
    'http://localhost:5174'
  ],
  credentials: true
}));

// Performance middleware
app.use(compression({ level: 6, threshold: 1024 }));

// Body parsing
app.use(express.json({ limit: '25mb' }));

// Logging
app.use(morgan('dev', { skip: () => process.env.NODE_ENV === 'test' }));

// Audit logging
app.use(audit);

// Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true
}));

// API routes
app.use('/api', routes);

// Static files
app.use(express.static('client/dist', {
  maxAge: '1y',
  immutable: true,
  index: false
}));

app.use('/warehouse', express.static('warehouse/dist', {
  maxAge: '1y',
  immutable: true,
  index: false
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile('client/dist/index.html', { root: process.cwd() });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
```

### Configuration Rules

1. **Always apply security middleware first** (helmet, cors)
2. **Always apply compression** before body parsing
3. **Always apply rate limiting** to prevent abuse
4. **Always apply audit logging** for tracking
5. **Always apply error handler last**
6. **Never skip middleware** without good reason

## Routing Standards

### Route File Structure

```typescript
// routes/customers.ts
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
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(1, 'Mobile is required'),
  email: z.string().email().optional()
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  email: z.string().email().optional()
});

// Routes
router.get('/', 
  authenticate, 
  branchScope, 
  cacheRoute(60), 
  asyncHandler(async (req: Request, res: Response) => {
    const customers = await req.branchModels.Customer.find();
    res.json(success(customers));
  })
);

router.post('/', 
  authenticate, 
  branchScope, 
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.json(fail(parsed.error.issues));
    }
    const customer = await req.branchModels.Customer.create(parsed.data);
    res.json(created(customer));
  })
);

router.get('/:id', 
  authenticate, 
  branchScope, 
  asyncHandler(async (req: Request, res: Response) => {
    const customer = await req.branchModels.Customer.findById(req.params.id);
    if (!customer) {
      return res.json(notFound('Customer not found'));
    }
    res.json(success(customer));
  })
);

router.put('/:id', 
  authenticate, 
  branchScope, 
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.json(fail(parsed.error.issues));
    }
    const customer = await req.branchModels.Customer.findByIdAndUpdate(
      req.params.id, 
      parsed.data, 
      { new: true }
    );
    if (!customer) {
      return res.json(notFound('Customer not found'));
    }
    res.json(success(customer));
  })
);

router.delete('/:id', 
  authenticate, 
  branchScope, 
  asyncHandler(async (req: Request, res: Response) => {
    const customer = await req.branchModels.Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.json(notFound('Customer not found'));
    }
    res.json(success({ message: 'Customer deleted' }));
  })
);

export default router;
```

### Route Rules

1. **Always use router files** for route definitions
2. **Always apply middleware** in correct order
3. **Always validate inputs** before processing
4. **Always use consistent response format**
5. **Always handle errors** with asyncHandler
6. **Never put business logic in routes**
7. **Never skip authentication** without good reason

### Route Naming

```typescript
// Resource routes
GET    /api/customers           // List customers
POST   /api/customers           // Create customer
GET    /api/customers/:id       // Get customer
PUT    /api/customers/:id       // Update customer
DELETE /api/customers/:id       // Delete customer

// Nested resources
GET    /api/customers/:id/visits // Get customer visits
POST   /api/customers/:id/visits // Create customer visit

// Action routes
PATCH  /api/orders/:id/status   // Update order status
POST   /api/orders/:id/review   // Toggle order review
```

## Middleware Standards

### Middleware Chain

```typescript
// Authentication → Branch Scope → Cache → Handler
router.get('/', 
  authenticate,           // Verify JWT token
  branchScope,            // Set up branch routing
  cacheRoute(60),         // Cache response
  asyncHandler(handler)   // Handle request
);
```

### Middleware Application Rules

1. **Always apply `authenticate`** for protected routes
2. **Always apply `branchScope`** for branch-scoped data
3. **Always apply `cacheRoute`** for GET requests
4. **Always apply `asyncHandler`** for async handlers
5. **Never apply `branchScope`** for global resources (users, branches)

### Custom Middleware

```typescript
// Middleware that modifies request
export const customMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Do something
  req.customProperty = 'value';
  next();
});

// Middleware that short-circuits
export const checkCondition = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (someCondition) {
    return res.status(403).json(fail('Forbidden'));
  }
  next();
});
```

## Request Handling

### Request Object

```typescript
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // Query parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;

  // Route parameters
  const id = req.params.id;

  // Body
  const body = req.body;

  // Headers
  const branchId = req.headers['x-branch-id'] as string;
  const authHeader = req.headers.authorization;

  // User (from authenticate middleware)
  const user = req.user;

  // Branch models (from branchScope middleware)
  const customers = await req.branchModels.Customer.find();

  res.json(success(customers));
}));
```

### Request Validation

```typescript
// Zod validation
const createSchema = z.object({
  name: z.string().min(1).max(100),
  mobile: z.string().min(10).max(15),
  email: z.string().email().optional(),
  age: z.number().min(0).max(150).optional()
});

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail(parsed.error.issues));
  }
  // Use parsed.data (type-safe)
}));
```

### Request Body Parsing

```typescript
// JSON body
app.use(express.json({ limit: '25mb' }));

// URL-encoded body
app.use(express.urlencoded({ extended: true }));

// Multipart form data
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
router.post('/upload', upload.single('file'), handler);
```

## Response Standards

### Response Format

```typescript
// Success response
res.json(success(data));

// Created response
res.json(created(data));

// Error response
res.json(fail('Error message'));

// Not found response
res.json(notFound('Resource not found'));

// With status code
res.status(201).json(created(data));
res.status(404).json(notFound('Resource not found'));
```

### Response Helpers

```typescript
// utils/response.ts
export function success(data: any) {
  return { success: true, data };
}

export function created(data: any) {
  return { success: true, data };
}

export function fail(message: string | any[]) {
  return { success: false, message };
}

export function notFound(message: string) {
  return { success: false, message };
}
```

### Response Rules

1. **Always use consistent response format**
2. **Always include `success` field**
3. **Always include `data` field** for successful responses
4. **Always include `message` field** for error responses
5. **Never expose internal details** in error responses
6. **Always set appropriate HTTP status codes**

## Error Handling

### AsyncHandler

```typescript
// middleware/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Error Handler

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // AppError
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

  // Mongoose CastError
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

## Security

### Helmet Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: false, // Disable for SPA
  crossOriginEmbedderPolicy: false
}));
```

### CORS Configuration

```typescript
app.use(cors({
  origin: [
    'https://kmjoptical.onrender.com',
    'http://localhost:5173',
    'http://localhost:4000',
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id']
}));
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' }
});

app.use('/api', apiLimiter);
```

## Performance

### Compression

```typescript
app.use(compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

### Caching

```typescript
// Cache middleware
export const cacheRoute = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = getCacheKey(req);
    const cached = await redis.get(key);

    if (cached) {
      res.setHeader('x-cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

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

## Testing

### Supertest

```typescript
import request from 'supertest';
import app from '../app';

describe('Customer API', () => {
  it('GET /api/customers should return customers', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/customers should create customer', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'John', mobile: '1234567890' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('John');
  });
});
```

## Cross-References

- **Backend architecture**: See `docs/07-backend.md`
- **Middleware**: See `docs/07-backend.md#middleware-standards`
- **Error handling**: See `docs/19-error-handling.md`
- **Security**: See `docs/22-security.md`
- **Performance**: See `docs/21-performance.md`

## AI Instructions

When working on Express.js code:
1. Always use asyncHandler for async handlers
2. Always validate inputs with Zod
3. Always use consistent response format
4. Always apply appropriate middleware
5. Always handle errors appropriately
6. Never put business logic in routes
7. Never skip authentication without good reason
8. Always use proper HTTP status codes
9. Always log errors appropriately
10. Always run linting after changes
