# 10 - Node.js

## Purpose

This document defines Node.js-specific patterns, conventions, and best practices for the KMJ Optical ERP backend. It covers runtime configuration, module system, error handling, and performance optimization.

## Runtime Configuration

### Node Version

**Required**: Node.js 16+ (check `.nvmrc` for exact version)

**Why**: Node 16+ provides:
- Native ES modules support
- Improved error handling
- Better performance
- Security patches

### Environment Variables

**Always use environment variables** for configuration:

```typescript
// config.ts
export const PORT = parseInt(process.env.PORT || '4000');
export const MONGO_URI = process.env.MONGO_URI || '';
export const JWT_SECRET = process.env.JWT_SECRET || '';
export const NODE_ENV = process.env.NODE_ENV || 'development';
```

**Never hardcode** configuration values:

```typescript
// BAD
const port = 4000;
const mongoUri = 'mongodb://localhost:27017/kmj-erp';

// GOOD
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || '';
```

### Graceful Shutdown

**Always implement graceful shutdown**:

```typescript
// index.ts
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await server.close();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await server.close();
  await mongoose.disconnect();
  process.exit(0);
});
```

## Module System

### ES Modules

**Use ES modules** (import/export) in TypeScript:

```typescript
// GOOD
import express from 'express';
import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export default router;
```

### CommonJS (Exception)

**Use CommonJS** (require/module.exports) only in specific cases:

```typescript
// GOOD: Only for lazy loading to avoid circular dependencies
const getModel = (modelName: string) => {
  return require(`../models/${modelName}`).default;
};
```

### Import Order

**Always group imports** in this order:

```typescript
// 1. External packages
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// 2. Internal modules (relative paths)
import { authenticate } from '../middleware/auth';
import { branchScope } from '../middleware/branch';
import { success, created } from '../utils/response';

// 3. Type imports
import type { Request, Response } from 'express';
import type { Document } from 'mongoose';
```

## Async/Await Standards

### Always Use async/await

```typescript
// BAD
function getCustomer(id: string) {
  return Customer.findById(id).then(customer => {
    if (!customer) throw new Error('Not found');
    return customer;
  });
}

// GOOD
async function getCustomer(id: string): Promise<Customer> {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, 'Customer not found');
  return customer;
}
```

### Parallel Execution

**Use `Promise.all`** for independent operations:

```typescript
// GOOD: Parallel execution
const [customers, orders, bills] = await Promise.all([
  Customer.find(),
  Order.find(),
  Bill.find()
]);

// BAD: Sequential execution (slower)
const customers = await Customer.find();
const orders = await Order.find();
const bills = await Bill.find();
```

### Error Handling

**Always wrap async operations** in try/catch:

```typescript
// BAD
async function processOrder(orderId: string) {
  const order = await Order.findById(orderId); // Unhandled rejection!
  await updateInventory(order);
}

// GOOD
async function processOrder(orderId: string): Promise<void> {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError(404, 'Order not found');
    await updateInventory(order);
  } catch (error) {
    logger.error('Failed to process order', { orderId, error });
    throw error;
  }
}
```

## Error Handling

### Error Types

```typescript
// Business errors
class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

// Usage
throw new AppError(404, 'Customer not found');
throw new AppError(400, 'Invalid input', { field: 'name', message: 'Required' });
```

### Error Handling Rules

1. **Always use AppError** for business errors
2. **Always use appropriate HTTP status codes**
3. **Never expose internal details** in error messages
4. **Always log errors** appropriately
5. **Always return consistent error format**

## Logging Standards

### Winston Logger

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Server started', { port: PORT });
logger.error('Database connection failed', { error: err.message });
logger.warn('Cache miss', { key: cacheKey });
```

### Logging Rules

1. **Always use structured logging** (JSON format)
2. **Always include context** (request ID, user ID, etc.)
3. **Never log sensitive data** (passwords, tokens, etc.)
4. **Always log errors** with full context
5. **Use appropriate log levels** (info, warn, error)

## Performance Optimization

### Connection Pooling

**Always use connection pooling** for database connections:

```typescript
mongoose.connect(MONGO_URI, {
  poolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

### Caching

**Always cache frequently accessed data**:

```typescript
// Redis caching
const cacheKey = `customer:${id}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const customer = await Customer.findById(id);
await redis.setex(cacheKey, 300, JSON.stringify(customer));
return customer;
```

### Indexing

**Always create indexes** for frequently queried fields:

```typescript
customerSchema.index({ mobile: 1 });
customerSchema.index({ customerId: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
```

### Pagination

**Always use pagination** for list queries:

```typescript
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const customers = await Customer.find()
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Customer.countDocuments();

  res.json(success({ customers, total, page, limit }));
});
```

## Security

### Input Validation

**Always validate all inputs**:

```typescript
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  mobile: z.string().min(10).max(15),
  email: z.string().email().optional()
});

router.post('/', async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail(parsed.error.issues));
  }
  // Process validated data
});
```

### SQL Injection Prevention

**Always use parameterized queries**:

```typescript
// BAD
const query = `SELECT * FROM customers WHERE name = '${name}'`;

// GOOD
const customer = await Customer.findOne({ name: name });
```

### XSS Prevention

**Always sanitize user input**:

```typescript
import DOMPurify from 'dompurify';

const cleanInput = DOMPurify.sanitize(userInput);
```

### Rate Limiting

**Always implement rate limiting**:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests'
});

app.use(limiter);
```

## Testing

### Unit Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { calculateOrderTotal } from './orderUtils';

describe('calculateOrderTotal', () => {
  it('should calculate total correctly', () => {
    const order = {
      framePrice: 1000,
      lensPrice: 500,
      coatingPrice: 200,
      accessories: []
    };

    const total = calculateOrderTotal(order);
    expect(total).toBe(1700);
  });

  it('should include accessory prices', () => {
    const order = {
      framePrice: 1000,
      lensPrice: 500,
      coatingPrice: 200,
      accessories: ['ACC-001', 'ACC-002']
    };

    const inventoryMap = new Map([
      ['ACC-001', { sellingPrice: 100 }],
      ['ACC-002', { sellingPrice: 150 }]
    ]);

    const total = calculateOrderTotal(order, inventoryMap);
    expect(total).toBe(1950);
  });
});
```

### Integration Testing

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

  describe('POST /api/customers', () => {
    it('should create a customer', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John', mobile: '1234567890' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('John');
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
```

## Cross-References

- **Backend architecture**: See `docs/07-backend.md`
- **Security**: See `docs/22-security.md`
- **Performance**: See `docs/21-performance.md`
- **Testing**: See `docs/23-testing.md`
- **Logging**: See `docs/20-logging.md`

## AI Instructions

When working on Node.js code:
1. Always use async/await
2. Always handle errors appropriately
3. Always validate inputs
4. Always use parameterized queries
5. Always implement rate limiting
6. Always use connection pooling
7. Always cache frequently accessed data
8. Never hardcode configuration
9. Never log sensitive data
10. Always run linting after changes
