# 05 - Coding Standards

## Purpose

This document defines the coding standards for the KMJ Optical ERP project. Every engineer and AI agent must follow these standards exactly. Consistency is not optional.

## TypeScript Standards

### Type Definitions

**Always use TypeScript**. Never write plain JavaScript.

**Always define explicit types** for function parameters and return values.

**Never use `any` type**. If you must use a flexible type, use `unknown` and narrow it.

```typescript
// BAD
function processData(data: any) {
  return data.map((item: any) => item.name);
}

// GOOD
function processData(data: Customer[]) {
  return data.map((item: Customer) => item.name);
}
```

**Always use interfaces for object shapes**:

```typescript
// BAD
function createCustomer(customer: { name: string; mobile: string }) {
  // ...
}

// GOOD
interface CreateCustomerInput {
  name: string;
  mobile: string;
}

function createCustomer(customer: CreateCustomerInput) {
  // ...
}
```

**Always use `type` for unions and intersections**:

```typescript
// BAD
interface OrderStatus {
  status: string;
}

// GOOD
type OrderStatus = 'Draft' | 'Ordered' | 'In Lab' | 'Ready' | 'Delivered' | 'Cancelled';
```

### Import/Export Standards

**Always use named exports** for utilities, hooks, and services:

```typescript
// BAD
export default function formatDate(date: Date) {
  // ...
}

// GOOD
export function formatDate(date: Date): string {
  // ...
}
```

**Always use default exports** for React components and Express routers:

```typescript
// BAD
export function Dashboard() {
  // ...
}

// GOOD
export default function Dashboard() {
  // ...
}
```

**Always use `import type` for type-only imports**:

```typescript
// BAD
import { Customer } from '../models/customer';

// GOOD
import type { Customer } from '../models/customer';
```

**Always group imports in this order**:
1. External packages
2. Internal modules (relative paths)
3. Type imports

```typescript
// GOOD
import express from 'express';
import { Router } from 'express';
import mongoose from 'mongoose';

import { authenticate } from '../middleware/auth';
import { branchScope } from '../middleware/branch';
import { success, created } from '../utils/response';

import type { Request, Response } from 'express';
```

### Function Standards

**Always specify return types** for functions:

```typescript
// BAD
function calculateTotal(order: Order) {
  return order.framePrice + order.lensPrice;
}

// GOOD
function calculateTotal(order: Order): number {
  return order.framePrice + order.lensPrice;
}
```

**Use `async/await` over `.then()` chains**:

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
  if (!customer) throw new Error('Not found');
  return customer;
}
```

**Keep functions small and focused**:

```typescript
// BAD: Function does too many things
async function processOrder(orderId: string) {
  // 1. Validate order
  // 2. Check inventory
  // 3. Calculate totals
  // 4. Create bill
  // 5. Process payment
  // 6. Send notification
  // 7. Update dashboard
  // 80 lines of code
}

// GOOD: Functions do one thing
async function processOrder(orderId: string): Promise<void> {
  const order = await validateOrder(orderId);
  await checkInventory(order);
  const totals = calculateTotals(order);
  const bill = await createBill(order, totals);
  await processPayment(bill);
  await sendNotification(order);
  await updateDashboard();
}
```

## JavaScript Standards

### Variables

**Always use `const` by default**. Use `let` only when reassignment is needed. Never use `var`.

```typescript
// BAD
var name = 'John';
let count = 0;
const items = [];

// GOOD
const name = 'John';
let count = 0;
const items = [];
```

**Always use descriptive variable names**:

```typescript
// BAD
const x = customers.filter(c => c.age > 18);

// GOOD
const adultCustomers = customers.filter(customer => customer.age > 18);
```

### Strings

**Always use template literals** for string interpolation:

```typescript
// BAD
const message = 'Hello, ' + name + '!';

// GOOD
const message = `Hello, ${name}!`;
```

**Always use single quotes** for strings:

```typescript
// BAD
const name = "John";

// GOOD
const name = 'John';
```

### Objects

**Always use shorthand properties**:

```typescript
// BAD
const customer = { name: name, mobile: mobile };

// GOOD
const customer = { name, mobile };
```

**Always use shorthand methods**:

```typescript
// BAD
const controller = {
  getCustomers: function() { return Customer.find(); }
};

// GOOD
const controller = {
  getCustomers() { return Customer.find(); }
};
```

### Arrays

**Always use arrow functions** for array methods:

```typescript
// BAD
const names = customers.map(function(c) { return c.name; });

// GOOD
const names = customers.map(customer => customer.name);
```

**Always use early returns**:

```typescript
// BAD
function getCustomer(id: string) {
  if (id) {
    return Customer.findById(id);
  } else {
    return null;
  }
}

// GOOD
function getCustomer(id: string) {
  if (!id) return null;
  return Customer.findById(id);
}
```

## Naming Conventions

### Variables and Functions

**Use camelCase** for variables and functions:

```typescript
// BAD
const customer_name = 'John';
function Get_Customer() { }

// GOOD
const customerName = 'John';
function getCustomer() { }
```

**Use descriptive names** that explain purpose:

```typescript
// BAD
const d = new Date();
const fn = (x) => x * 2;
const arr = items.filter(i => i.active);

// GOOD
const currentDate = new Date();
const doubleValue = (number) => number * 2;
const activeItems = items.filter(item => item.active);
```

### Classes and Interfaces

**Use PascalCase** for classes and interfaces:

```typescript
// BAD
class customerController { }
interface order_status { }

// GOOD
class CustomerController { }
interface OrderStatus { }
```

### Constants

**Use UPPER_SNAKE_CASE** for true constants:

```typescript
// BAD
const maxRetries = 3;
const defaultStatus = 'Draft';

// GOOD
const MAX_RETRIES = 3;
const DEFAULT_STATUS = 'Draft';
const VALID_TRANSITIONS = {
  Draft: ['Ordered', 'Cancelled'],
  // ...
};
```

### Private Members

**Use underscore prefix** for private members:

```typescript
// BAD
class Service {
  private cache: Map<string, any>;
  private connect() { }
}

// GOOD
class Service {
  private _cache: Map<string, any>;
  private _connect() { }
}
```

## Code Organization

### File Structure

**Organize files in this order**:

1. Imports
2. Types/Interfaces
3. Constants
4. Helper functions
5. Main functions/classes
6. Exports

```typescript
// GOOD
import express from 'express';
import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import { success } from '../utils/response';

import type { Request, Response } from 'express';

interface Customer {
  _id: string;
  name: string;
  mobile: string;
}

const MAX_PAGE_SIZE = 100;

function validateCustomer(data: unknown): Customer {
  // ...
}

export default router;
```

### Function Organization

**Organize functions in this order**:

1. Helper functions (private)
2. Main functions (public)
3. Exported functions

```typescript
// GOOD
// Helper functions
function calculateSubtotal(items: BillItem[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}

// Main functions
export async function createBill(data: CreateBillInput): Promise<Bill> {
  const subtotal = calculateSubtotal(data.items);
  const tax = calculateTax(subtotal, data.taxRate || 0);
  // ...
}
```

## Error Handling Standards

### Always Use AppError for Business Errors

```typescript
// BAD
throw new Error('Customer not found');

// GOOD
throw new AppError(404, 'Customer not found');
```

### Always Handle Async Errors

```typescript
// BAD
router.get('/', async (req, res) => {
  const customers = await Customer.find(); // Unhandled rejection!
  res.json(customers);
});

// GOOD
router.get('/', asyncHandler(async (req, res) => {
  const customers = await Customer.find();
  res.json(success(customers));
}));
```

### Always Provide Meaningful Error Messages

```typescript
// BAD
throw new AppError(400, 'Invalid input');

// GOOD
throw new AppError(400, 'Customer name is required');
```

## Validation Standards

### Always Validate Inputs

```typescript
// BAD
router.post('/', async (req, res) => {
  const customer = await Customer.create(req.body); // No validation!
});

// GOOD
router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail(parsed.error.issues));
  }
  const customer = await Customer.create(parsed.data);
});
```

### Always Use Zod for Complex Validation

```typescript
// BAD
if (!req.body.name || !req.body.mobile) {
  return res.status(400).json({ error: 'Name and mobile required' });
}

// GOOD
const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(1, 'Mobile is required'),
});

const parsed = createSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json(fail(parsed.error.issues));
}
```

## Response Standards

### Always Use Consistent Response Format

```typescript
// BAD
res.json({ data: customers });
res.json({ success: true, customers: customers });
res.json({ ok: true, result: customers });

// GOOD
import { success, created, fail, notFound } from '../utils/response';

res.json(success(customers));
res.json(created(customer));
res.json(fail('Invalid input'));
res.json(notFound('Customer not found'));
```

## Documentation Standards

### Always Document Complex Logic

```typescript
// BAD
const calculateOrderTotal = (order: Order) => {
  return order.framePrice + order.lensPrice + order.coatingPrice + 
    (order.accessories?.reduce((sum, acc) => sum + (inventoryMap.get(acc)?.sellingPrice || 0), 0) || 0);
};

// GOOD
/**
 * Calculates the total order amount.
 * 
 * Business rule: Total = Frame + Lens + Coating + Accessories
 * - Accessory prices are looked up from inventory by SKU
 * - If an accessory SKU is not found in inventory, its price is 0
 * 
 * @see knowledge/business-domains.md#order-pricing
 */
const calculateOrderTotal = (order: Order): number => {
  const accessoryTotal = order.accessories?.reduce((sum, acc) => {
    const price = inventoryMap.get(acc)?.sellingPrice || 0;
    return sum + price;
  }, 0) || 0;
  
  return order.framePrice + order.lensPrice + order.coatingPrice + accessoryTotal;
};
```

### Always Document API Endpoints

```typescript
// BAD
router.get('/', async (req, res) => {
  // ...
});

// GOOD
/**
 * GET /api/customers
 * 
 * List all customers for the current branch.
 * 
 * Query Parameters:
 * - page (number, default 1): Page number
 * - limit (number, default 20): Items per page
 * - search (string): Search by name or mobile
 * 
 * Response:
 * {
 *   success: true,
 *   data: Customer[]
 * }
 * 
 * @see knowledge/business-domains.md#customers
 */
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  // ...
}));
```

## Anti-Patterns to Avoid

### 1. Magic Numbers

```typescript
// BAD
if (order.status === 5) { }
setTimeout(() => { }, 5000);

// GOOD
const ORDER_STATUS_DELIVERED = 5;
const RECONNECT_DELAY_MS = 5000;

if (order.status === ORDER_STATUS_DELIVERED) { }
setTimeout(() => { }, RECONNECT_DELAY_MS);
```

### 2. Deep Nesting

```typescript
// BAD
if (user) {
  if (user.role === 'owner') {
    if (user.branches.length > 0) {
      // 10 lines of code
    }
  }
}

// GOOD
if (!user) return;
if (user.role !== 'owner') return;
if (user.branches.length === 0) return;

// 10 lines of code
```

### 3. God Functions

```typescript
// BAD
async function processEverything(data: any) {
  // 200 lines doing everything
}

// GOOD
async function processOrder(data: OrderInput): Promise<Order> {
  const validated = validateOrder(data);
  const order = await createOrder(validated);
  await updateInventory(order);
  await sendNotification(order);
  return order;
}
```

### 4. Hardcoded Values

```typescript
// BAD
const rateLimit = 200;

// GOOD
const RATE_LIMIT = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
```

### 5. Inconsistent Error Handling

```typescript
// BAD
try {
  const data = await fetchData();
} catch (e) {
  console.log(e); // Sometimes logs, sometimes throws, sometimes ignores
}

// GOOD
try {
  const data = await fetchData();
} catch (error) {
  logger.error('Failed to fetch data', { error });
  throw new AppError(500, 'Failed to fetch data');
}
```

## Cross-References

- **Naming conventions**: See `docs/06-naming-conventions.md`
- **Error handling**: See `docs/19-error-handling.md`
- **Validation**: See `docs/18-validation.md`
- **Backend standards**: See `docs/07-backend.md`
- **Frontend standards**: See `docs/08-frontend.md`

## AI Instructions

When working on this project:
1. Follow these standards exactly
2. Don't use `any` type
3. Don't use `var`
4. Don't use `.then()` chains
5. Don't skip error handling
6. Don't skip validation
7. Don't skip documentation
8. Always use consistent naming
9. Always use consistent response format
10. Always run linting after changes
