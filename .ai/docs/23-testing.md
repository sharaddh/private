# 23 — Testing

## Purpose

Testing is the safety net that lets you refactor, add features, and fix bugs with confidence. The KMJ Optical ERP system requires thorough testing at multiple levels — unit tests for utilities, integration tests for API routes, and end-to-end tests for critical business flows like order creation and payment processing. Without tests, every deployment is a gamble.

## Core Principles

### 1. Test Pyramid

Follow the test pyramid: many unit tests at the base, fewer integration tests in the middle, and minimal E2E tests at the top.

```
        /  E2E  \          ← Few: critical user journeys
       / Integration \     ← Moderate: API route + DB + middleware
      /   Unit Tests   \   ← Many: utilities, models, validators
     ───────────────────
```

- **Unit Tests**: Fast, isolated, test single functions/modules. No DB, no network.
- **Integration Tests**: Test route handlers with real MongoDB (or in-memory), middleware chains, model operations.
- **E2E Tests**: Simulate full HTTP requests through the app, testing the full stack.

### 2. Test What Matters

Prioritize tests by business risk:

| Priority | What to Test | Example |
|----------|-------------|---------|
| Critical | Payment flows, order creation | `POST /api/bills` with payment |
| High | Authentication, authorization | JWT validation, role checks |
| Medium | CRUD operations, validation | Customer create/update |
| Low | Utility functions, formatting | `formatPhone()`, `formatCurrency()` |

### 3. Tests as Documentation

Tests should read like specifications. A well-written test tells you what the code does and what edge cases are handled.

### 4. Arrange-Act-Assert

Every test follows the AAA pattern:

```typescript
it('should reject expired JWT tokens', async () => {
  // Arrange
  const expiredToken = jwt.sign(
    { userId: 'user123', role: 'user', branchAccess: ['branch1'] },
    JWT_SECRET,
    { expiresIn: '0s' } // expired
  );

  // Act
  const res = await request(app)
    .get('/api/customers')
    .set('Authorization', `Bearer ${expiredToken}`);

  // Assert
  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
});
```

## Detailed Rules

### Test Framework Setup

Use **Jest** as the test runner with **supertest** for HTTP assertions:

```json
// package.json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^9.0.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0"
  }
}
```

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterSetup: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000
};
```

### Test Directory Structure

```
server/src/
  __tests__/
    setup.ts                    # Global test setup (DB connection, etc.)
    helpers/
      testDb.ts                 # In-memory MongoDB setup
      testApp.ts                # Express app factory for testing
      fixtures.ts               # Reusable test data
    unit/
      utils/
        phone.test.ts
        response.test.ts
        jwt.test.ts
      models/
        customer.test.ts
        user.test.ts
      services/
        cache.test.ts
    integration/
      routes/
        auth.test.ts
        customers.test.ts
        orders.test.ts
        bills.test.ts
        payments.test.ts
        inventory.test.ts
      middleware/
        auth.test.ts
        branch.test.ts
        validation.test.ts
    e2e/
      orderWorkflow.test.ts
      paymentFlow.test.ts
```

### In-Memory MongoDB for Integration Tests

Never use a real database in tests. Use `mongodb-memory-server`:

```typescript
// __tests__/helpers/testDb.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function connectTestDb() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function disconnectTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

### Test App Factory

Create a clean Express app instance for each test without starting the server:

```typescript
// __tests__/helpers/testApp.ts
import express from 'express';
import cors from 'cors';
import { errorHandler } from '../../middleware/errorHandler';
import { requestContext } from '../../middleware/requestContext';
import authRoutes from '../../routes/auth';
import customerRoutes from '../../routes/customers';
import orderRoutes from '../../routes/orders';
import billRoutes from '../../routes/bills';
import paymentRoutes from '../../routes/payments';

export function createTestApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestContext);

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/bills', billRoutes);
  app.use('/api/payments', paymentRoutes);

  // Error handler last
  app.use(errorHandler);

  return app;
}
```

### Test Fixtures

Define reusable test data in a fixtures file:

```typescript
// __tests__/helpers/fixtures.ts
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { UserDocument } from '../../models/user';
import { BranchDocument } from '../../models/branch';
import { CustomerDocument } from '../../models/customer';
import { OrderDocument } from '../../models/order';
import User from '../../models/user';
import Branch from '../../models/branch';
import Customer from '../../models/customer';
import Order from '../../models/order';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// ── Branch Fixtures ──

export async function createTestBranch(
  overrides: Partial<BranchDocument> = {}
): Promise<BranchDocument> {
  return Branch.create({
    name: 'Test Branch',
    code: 'TB01',
    phone: '9876543210',
    address: '123 Test Street',
    isActive: true,
    ...overrides
  });
}

// ── User Fixtures ──

export async function createTestUser(
  branchId: mongoose.Types.ObjectId,
  overrides: Partial<UserDocument> = {}
): Promise<UserDocument> {
  return User.create({
    name: 'Test User',
    phone: '9876543210',
    password: await hashPassword('testpass123'),
    role: 'user',
    branchAccess: [branchId],
    isActive: true,
    ...overrides
  });
}

export async function createAdminUser(
  branchId: mongoose.Types.ObjectId,
  overrides: Partial<UserDocument> = {}
): Promise<UserDocument> {
  return User.create({
    name: 'Admin User',
    phone: '9876543211',
    password: await hashPassword('adminpass123'),
    role: 'admin',
    branchAccess: [branchId],
    isActive: true,
    ...overrides
  });
}

// ── Token Fixtures ──

export function generateAuthToken(user: UserDocument): string {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      branchAccess: user.branchAccess
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

export function generateExpiredToken(user: UserDocument): string {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      branchAccess: user.branchAccess
    },
    JWT_SECRET,
    { expiresIn: '0s' }
  );
}

// ── Customer Fixtures ──

export async function createTestCustomer(
  branchId: mongoose.Types.ObjectId,
  overrides: Record<string, any> = {}
): Promise<CustomerDocument> {
  return Customer.create({
    name: 'Test Customer',
    phone: '9876543210',
    branch: branchId,
    address: {
      street: '123 Customer St',
      city: 'Testville',
      state: 'TS',
      pincode: '123456'
    },
    ...overrides
  });
}

// ── Order Fixtures ──

export async function createTestOrder(
  branchId: mongoose.Types.ObjectId,
  customerId: mongoose.Types.ObjectId,
  overrides: Record<string, any> = {}
): Promise<OrderDocument> {
  return Order.create({
    customer: customerId,
    branch: branchId,
    status: 'pending',
    priority: 'normal',
    items: [
      {
        type: 'frame',
        name: 'Test Frame',
        quantity: 1,
        unitPrice: 1500,
        total: 1500
      }
    ],
    totalAmount: 1500,
    ...overrides
  });
}
```

### Unit Tests

#### Testing Utility Functions

```typescript
// __tests__/unit/utils/phone.test.ts
import { normalizePhone, isValidPhone } from '../../../utils/phone';

describe('normalizePhone', () => {
  it('should add +91 prefix to 10-digit Indian number', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });

  it('should add + prefix to 12-digit number starting with 91', () => {
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('should return already-formatted number unchanged', () => {
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('should handle numbers with spaces and dashes', () => {
    expect(normalizePhone('987-654-3210')).toBe('+919876543210');
    expect(normalizePhone('987 654 3210')).toBe('+919876543210');
  });
});

describe('isValidPhone', () => {
  it('should accept valid 10-digit number', () => {
    expect(isValidPhone('9876543210')).toBe(true);
  });

  it('should reject numbers shorter than 10 digits', () => {
    expect(isValidPhone('987654321')).toBe(false);
  });

  it('should reject non-numeric strings', () => {
    expect(isValidPhone('abcdefghij')).toBe(false);
  });
});
```

#### Testing Response Helpers

```typescript
// __tests__/unit/utils/response.test.ts
import { successResponse, errorResponse, paginatedResponse } from '../../../utils/response';

describe('successResponse', () => {
  it('should wrap data in standard success format', () => {
    const result = successResponse({ id: 1, name: 'Test' });
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: 'Test' }
    });
  });

  it('should include optional message', () => {
    const result = successResponse({ id: 1 }, 'Created successfully');
    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      message: 'Created successfully'
    });
  });
});

describe('errorResponse', () => {
  it('should wrap error in standard error format', () => {
    const result = errorResponse('Not found', 404);
    expect(result).toEqual({
      success: false,
      error: 'Not found',
      statusCode: 404
    });
  });
});

describe('paginatedResponse', () => {
  it('should include pagination metadata', () => {
    const result = paginatedResponse(
      [{ id: 1 }],
      { page: 1, limit: 10, total: 25, totalPages: 3 }
    );
    expect(result).toEqual({
      success: true,
      data: [{ id: 1 }],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      }
    });
  });
});
```

#### Testing JWT Utilities

```typescript
// __tests__/unit/utils/jwt.test.ts
import { generateToken, verifyToken, decodeToken } from '../../../utils/jwt';

const TEST_SECRET = 'test-jwt-secret-key';

describe('generateToken', () => {
  it('should generate a valid JWT string', () => {
    const token = generateToken(
      { userId: 'user123', role: 'user', branchAccess: ['branch1'] },
      TEST_SECRET
    );
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });
});

describe('verifyToken', () => {
  it('should return decoded payload for valid token', () => {
    const payload = { userId: 'user123', role: 'user', branchAccess: ['branch1'] };
    const token = generateToken(payload, TEST_SECRET);
    const decoded = verifyToken(token, TEST_SECRET);
    expect(decoded.userId).toBe('user123');
    expect(decoded.role).toBe('user');
  });

  it('should throw on expired token', () => {
    const payload = { userId: 'user123', role: 'user', branchAccess: ['branch1'] };
    const token = generateToken(payload, TEST_SECRET, '0s'); // expired
    expect(() => verifyToken(token, TEST_SECRET)).toThrow();
  });

  it('should throw on invalid signature', () => {
    const payload = { userId: 'user123', role: 'user', branchAccess: ['branch1'] };
    const token = generateToken(payload, TEST_SECRET);
    expect(() => verifyToken(token, 'wrong-secret')).toThrow();
  });
});
```

### Integration Tests

#### Testing Auth Routes

```typescript
// __tests__/integration/routes/auth.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp';
import { connectTestDb, disconnectTestDb, clearDb } from '../../helpers/testDb';
import { createTestBranch, createTestUser, generateAuthToken } from '../../helpers/fixtures';
import bcrypt from 'bcryptjs';
import User from '../../../models/user';

const app = createTestApp();

beforeAll(async () => await connectTestDb());
afterEach(async () => await clearDb());
afterAll(async () => await disconnectTestDb());

describe('POST /api/auth/login', () => {
  it('should return token for valid credentials', async () => {
    const branch = await createTestBranch();
    await createTestUser(branch._id, {
      phone: '9876543210',
      password: await bcrypt.hash('password123', 10)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.phone).toBe('9876543210');
  });

  it('should reject invalid password', async () => {
    const branch = await createTestBranch();
    await createTestUser(branch._id, {
      phone: '9876543210',
      password: await bcrypt.hash('password123', 10)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-existent phone number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0000000000', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should validate required fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210' }); // missing password

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/register', () => {
  it('should create new user with valid data', async () => {
    const branch = await createTestBranch();
    const adminToken = generateAuthToken(
      await createTestUser(branch._id, { role: 'admin' })
    );

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New User',
        phone: '9876543211',
        password: 'newpass123',
        role: 'user',
        branchAccess: [branch._id.toString()]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe('New User');
  });

  it('should reject registration without admin token', async () => {
    const branch = await createTestBranch();
    const userToken = generateAuthToken(
      await createTestUser(branch._id, { role: 'user' })
    );

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'New User',
        phone: '9876543211',
        password: 'newpass123',
        role: 'user',
        branchAccess: [branch._id.toString()]
      });

    expect(res.status).toBe(403);
  });
});
```

#### Testing Branch-Scoped Routes

```typescript
// __tests__/integration/routes/customers.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp';
import { connectTestDb, disconnectTestDb, clearDb } from '../../helpers/testDb';
import {
  createTestBranch,
  createTestUser,
  createAdminUser,
  createTestCustomer,
  generateAuthToken
} from '../../helpers/fixtures';

const app = createTestApp();

beforeAll(async () => await connectTestDb());
afterEach(async () => await clearDb());
afterAll(async () => await disconnectTestDb());

describe('GET /api/customers', () => {
  it('should only return customers from user\'s branch', async () => {
    const branch1 = await createTestBranch({ name: 'Branch 1', code: 'BR01' });
    const branch2 = await createTestBranch({ name: 'Branch 2', code: 'BR02' });

    const user1 = await createTestUser(branch1._id);
    const token1 = generateAuthToken(user1);

    await createTestCustomer(branch1._id, { name: 'Customer A' });
    await createTestCustomer(branch2._id, { name: 'Customer B' });

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token1}`)
      .set('x-branch-id', branch1._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Customer A');
  });

  it('should allow admin to access all branches', async () => {
    const branch1 = await createTestBranch({ name: 'Branch 1', code: 'BR01' });
    const branch2 = await createTestBranch({ name: 'Branch 2', code: 'BR02' });

    const admin = await createAdminUser(branch1._id);
    const token = generateAuthToken(admin);

    await createTestCustomer(branch1._id, { name: 'Customer A' });
    await createTestCustomer(branch2._id, { name: 'Customer B' });

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch1._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('should return 403 for inactive user', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id, { isActive: false });
    const token = generateAuthToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString());

    expect(res.status).toBe(403);
  });
});

describe('POST /api/customers', () => {
  it('should create customer in user\'s branch', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateAuthToken(user);

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString())
      .send({
        name: 'New Customer',
        phone: '9876543211',
        address: {
          street: '456 New St',
          city: 'Newcity',
          state: 'NS',
          pincode: '654321'
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.branch.toString()).toBe(branch._id.toString());
  });

  it('should reject customer creation with invalid data', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateAuthToken(user);

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString())
      .send({ name: '' }); // missing required fields

    expect(res.status).toBe(400);
  });
});
```

### Testing Middleware

```typescript
// __tests__/integration/middleware/auth.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp';
import { connectTestDb, disconnectTestDb, clearDb } from '../../helpers/testDb';
import { createTestBranch, createTestUser, generateAuthToken, generateExpiredToken } from '../../helpers/fixtures';

const app = createTestApp();

beforeAll(async () => await connectTestDb());
afterEach(async () => await clearDb());
afterAll(async () => await disconnectTestDb());

describe('Auth Middleware', () => {
  it('should attach user to request for valid token', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateAuthToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString());

    expect(res.status).toBe(200);
  });

  it('should return 401 for missing Authorization header', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('token');
  });

  it('should return 401 for malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', 'InvalidFormat');

    expect(res.status).toBe(401);
  });

  it('should return 401 for expired token', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateExpiredToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString());

    expect(res.status).toBe(401);
  });
});

describe('Branch Middleware', () => {
  it('should set activeBranchId from x-branch-id header', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateAuthToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch._id.toString());

    expect(res.status).toBe(200);
  });

  it('should reject branch not in user\'s access list', async () => {
    const branch1 = await createTestBranch();
    const branch2 = await createTestBranch();
    const user = await createTestUser(branch1._id); // only access to branch1
    const token = generateAuthToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branch2._id.toString());

    expect(res.status).toBe(403);
  });

  it('should default to first branch if no header provided', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser(branch._id);
    const token = generateAuthToken(user);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
```

### Testing Validation

```typescript
// __tests__/integration/middleware/validation.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp';
import { connectTestDb, disconnectTestDb, clearDb } from '../../helpers/testDb';
import { createTestBranch, createTestUser, generateAuthToken } from '../../helpers/fixtures';

const app = createTestApp();

beforeAll(async () => await connectTestDb());
afterEach(async () => await clearDb());
afterAll(async () => await disconnectTestDb());

describe('Request Validation', () => {
  let token: string;
  let branchId: string;

  beforeEach(async () => {
    const branch = await createTestBranch();
    branchId = branch._id.toString();
    const user = await createTestUser(branch._id);
    token = generateAuthToken(user);
  });

  it('should reject invalid phone format', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({
        name: 'Test',
        phone: '123' // too short
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should accept valid request data', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({
        name: 'Valid Customer',
        phone: '9876543210',
        address: {
          street: '123 Street',
          city: 'City',
          state: 'ST',
          pincode: '123456'
        }
      });

    expect(res.status).toBe(201);
  });
});
```

### Mocking

#### Mocking External Services

```typescript
// __tests__/unit/services/whatsapp.test.ts
import { WhatsAppService } from '../../../services/whatsapp';

// Mock the Baileys library
jest.mock('@whiskeysockets/baileys', () => ({
  default: {
    makeWASocket: jest.fn(),
    useMultiFileAuthState: jest.fn(),
    delay: jest.fn()
  }
}));

// Mock the cache service
jest.mock('../../../services/cache', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn()
  }
}));

describe('WhatsAppService', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    service = new WhatsAppService();
    jest.clearAllMocks();
  });

  it('should send message to valid phone number', async () => {
    const mockSend = jest.fn().mockResolvedValue({ key: { id: 'msg123' } });
    (service as any).sock = { sendMessage: mockSend };

    const result = await service.sendMessage('9876543210', 'Hello');

    expect(mockSend).toHaveBeenCalledWith(
      '919876543210@s.whatsapp.net',
      { text: 'Hello' }
    );
  });

  it('should throw on invalid phone number', async () => {
    await expect(service.sendMessage('123', 'Hello')).rejects.toThrow();
  });
});
```

#### Mocking MongoDB Models

```typescript
// __tests__/unit/models/customer.test.ts
import Customer from '../../../models/customer';

jest.mock('../../../models/customer', () => {
  const mockCustomer = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  };
  return { __esModule: true, default: mockCustomer };
});

describe('Customer Model Operations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create customer with valid data', async () => {
    const mockData = {
      name: 'Test',
      phone: '9876543210',
      branch: 'branch123'
    };
    (Customer.create as jest.Mock).mockResolvedValue({ _id: 'cust1', ...mockData });

    const result = await Customer.create(mockData);
    expect(result.name).toBe('Test');
    expect(Customer.create).toHaveBeenCalledWith(mockData);
  });

  it('should find customers by branch', async () => {
    const mockCustomers = [
      { _id: 'c1', name: 'Customer 1', branch: 'branch123' },
      { _id: 'c2', name: 'Customer 2', branch: 'branch123' }
    ];
    (Customer.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockCustomers)
        })
      })
    });

    const result = await Customer.find({ branch: 'branch123' })
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(10);

    expect(result).toHaveLength(2);
  });
});
```

### Testing Error Handling

```typescript
// __tests__/integration/middleware/errorHandler.test.ts
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../../middleware/errorHandler';
import { ApiError } from '../../../utils/errors';

function createErrorApp(): express.Application {
  const app = express();
  app.use(express.json());

  app.get('/test/validation-error', (req, res, next) => {
    next(new ApiError('Validation failed', 400, 'VALIDATION_ERROR'));
  });

  app.get('/test/not-found', (req, res, next) => {
    next(new ApiError('Customer not found', 404, 'NOT_FOUND'));
  });

  app.get('/test/internal-error', (req, res, next) => {
    next(new Error('Unexpected database connection failure'));
  });

  app.use(errorHandler);
  return app;
}

const app = createErrorApp();

describe('Error Handler Middleware', () => {
  it('should return structured validation error', async () => {
    const res = await request(app).get('/test/validation-error');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  });

  it('should return structured not-found error', async () => {
    const res = await request(app).get('/test/not-found');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Customer not found',
      code: 'NOT_FOUND'
    });
  });

  it('should mask internal errors in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/test/internal-error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.stack).toBeUndefined();
    process.env.NODE_ENV = 'test';
  });
});
```

### CI/CD Test Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration -- --coverage
        env:
          MONGODB_URI: mongodb://localhost:27017/kmj-test
          JWT_SECRET: test-secret-for-ci
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Examples

### Example: Complete Order Flow Integration Test

```typescript
// __tests__/integration/routes/orderWorkflow.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp';
import { connectTestDb, disconnectTestDb, clearDb } from '../../helpers/testDb';
import {
  createTestBranch,
  createTestUser,
  createTestCustomer,
  createTestOrder,
  generateAuthToken
} from '../../helpers/fixtures';

const app = createTestApp();

beforeAll(async () => await connectTestDb());
afterEach(async () => await clearDb());
afterAll(async () => await disconnectTestDb());

describe('Order Workflow - End to End', () => {
  let token: string;
  let branchId: string;
  let customerId: string;

  beforeEach(async () => {
    const branch = await createTestBranch();
    branchId = branch._id.toString();
    const user = await createTestUser(branch._id);
    token = generateAuthToken(user);
    const customer = await createTestCustomer(branch._id);
    customerId = customer._id.toString();
  });

  it('should complete full order lifecycle', async () => {
    // Step 1: Create order
    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({
        customer: customerId,
        items: [
          {
            type: 'frame',
            name: 'Ray-Ban Aviator',
            quantity: 1,
            unitPrice: 3500,
            total: 3500
          },
          {
            type: 'lens',
            name: 'Progressive Lens',
            quantity: 1,
            unitPrice: 2000,
            total: 2000
          }
        ],
        notes: 'Customer prefers gold frame color'
      });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data._id;

    // Step 2: Verify order appears in list
    const listRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((o: any) => o._id === orderId)).toBe(true);

    // Step 3: Update order status
    const updateRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({ status: 'in-progress' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('in-progress');

    // Step 4: Get order details
    const detailRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.items).toHaveLength(2);
    expect(detailRes.body.data.totalAmount).toBe(5500);

    // Step 5: Create bill from order
    const billRes = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({
        customer: customerId,
        order: orderId,
        items: [
          { description: 'Frame', amount: 3500 },
          { description: 'Lens', amount: 2000 }
        ],
        totalAmount: 5500,
        paymentMethod: 'cash'
      });

    expect(billRes.status).toBe(201);
    expect(billRes.body.data.invoiceNumber).toBeDefined();

    // Step 6: Record payment
    const paymentRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-branch-id', branchId)
      .send({
        bill: billRes.body.data._id,
        amount: 5500,
        method: 'cash',
        reference: 'CASH-001'
      });

    expect(paymentRes.status).toBe(201);
  });
});
```

## Bad Examples

### Bad: Testing Against Real Database

```typescript
// ❌ BAD - Uses real database, causes flaky tests and data pollution
it('should create customer', async () => {
  const res = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${realToken}`)
    .send({ name: 'Test', phone: '1234567890' });

  expect(res.status).toBe(201);

  // Cleanup pollutes other tests if this fails
  await Customer.findByIdAndDelete(res.body.data._id);
});
```

### Bad: Tightly Coupled Tests

```typescript
// ❌ BAD - Test depends on database state from previous test
let customerId: string;

it('should create customer', async () => {
  const res = await request(app)
    .post('/api/customers')
    .send({ name: 'Test', phone: '1234567890' });
  customerId = res.body.data._id;
  expect(res.status).toBe(201);
});

it('should get customer', async () => {
  // FAILS if first test fails - tightly coupled!
  const res = await request(app)
    .get(`/api/customers/${customerId}`);
  expect(res.status).toBe(200);
});
```

### Bad: Asserting Implementation Details

```typescript
// ❌ BAD - Tests implementation, not behavior
it('should call find with correct query', async () => {
  const spy = jest.spyOn(Customer, 'find');
  await getCustomers('branch123');
  expect(spy).toHaveBeenCalledWith({ branch: 'branch123' });
  spy.mockRestore();
});

// ✅ GOOD - Tests behavior, not implementation
it('should return only customers from specified branch', async () => {
  const customers = await getCustomers('branch123');
  customers.forEach(c => {
    expect(c.branch.toString()).toBe('branch123');
  });
});
```

### Bad: Skipping Tests

```typescript
// ❌ BAD - Skipping tests hides problems
it.skip('should handle concurrent order updates', async () => {
  // TODO: implement later
});

// ✅ GOOD - Mark as todo with clear intent
it.todo('should handle concurrent order updates when two users edit same order');
```

## Tradeoffs

### Mock vs Real Database

| Approach | Pros | Cons |
|----------|------|------|
| **In-Memory MongoDB** | Realistic queries, catches ODM issues | Slower, may miss edge cases with real MongoDB |
| **Mocked Mongoose** | Fast, isolated | Doesn't catch query bugs, schema issues |
| **Real Test Database** | Most realistic | Slow, requires cleanup, flaky |

**Decision**: Use `mongodb-memory-server` for integration tests (realistic + isolated). Mock Mongoose only for unit tests where you need pure function testing.

### Test Coverage Thresholds

- **80% line coverage** is the minimum. Higher is better but diminishing returns past 90%.
- **Critical paths** (auth, payments, orders) should have 95%+ coverage.
- **Utility functions** should have 100% coverage since they're easy to test.

### Snapshot Testing

Avoid snapshot testing for API responses — they break on every minor change and provide false confidence. Use explicit assertions instead.

## Cross-References

- **19-error-handling.md** — Error response structure tested in error handler tests
- **15-authentication.md** — JWT token generation tested in auth tests
- **16-authorization.md** — Role-based access tested in middleware tests
- **17-rbac.md** — Permission checks tested in authorization tests
- **18-validation.md** — Validation schemas tested in validation tests
- **20-logging.md** — Logger mocks needed in tests that verify logging
- **22-security.md** — Security concerns addressed in auth/authorization tests

## AI Instructions

1. **Always create isolated tests** — each test must set up its own data and not depend on other tests.
2. **Use `beforeEach` for cleanup** — call `clearDb()` in `afterEach` to reset state.
3. **Test both success and failure paths** — every route should have tests for valid input, invalid input, unauthorized access, and not-found scenarios.
4. **Never hardcode IDs** — always create test data in `beforeEach` and use the returned IDs.
5. **Mock external services** — WhatsApp, email, SMS should be mocked in tests. Never hit real APIs.
6. **Use TypeScript types** — test files should be fully typed. Avoid `any` in test assertions where possible.
7. **Keep tests fast** — if a test suite takes more than 30 seconds, optimize it. Slow tests discourage running them.
8. **Test edge cases** — empty arrays, null values, Unicode characters, very long strings, negative numbers.
9. **One assertion per concept** — each `it` block should test one behavior. Split complex assertions into multiple tests.
10. **Write tests before fixing bugs** — create a failing test that reproduces the bug, then fix it. The test ensures it doesn't regress.
