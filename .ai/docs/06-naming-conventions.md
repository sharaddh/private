# 06 - Naming Conventions

## Purpose

This document defines the naming conventions for the KMJ Optical ERP project. Consistent naming is critical for code readability, maintainability, and AI agent comprehension.

## File Naming

### Server Files

| Type | Convention | Example | Location |
|------|-----------|---------|----------|
| Entry point | `index.ts` | `index.ts` | `server/src/` |
| App config | `app.ts` | `app.ts` | `server/src/` |
| Config | `config.ts` | `config.ts` | `server/src/` |
| Route | camelCase (plural) | `customers.ts` | `server/src/routes/` |
| Controller | camelCase + `Controller` | `authController.ts` | `server/src/controllers/` |
| Model | camelCase (singular) | `customer.ts` | `server/src/models/` |
| Middleware | camelCase | `auth.ts` | `server/src/middleware/` |
| Service | camelCase | `cache.ts` | `server/src/services/` |
| Utility | camelCase | `jwt.ts` | `server/src/utils/` |
| Script | camelCase | `recalculate-customers.ts` | `server/src/scripts/` |
| Migration | camelCase | `migrate-legacy.ts` | `server/src/migrations/` |

### Client Files

| Type | Convention | Example | Location |
|------|-----------|---------|----------|
| Entry point | `main.tsx` | `main.tsx` | `client/src/` |
| Root component | `App.tsx` | `App.tsx` | `client/src/` |
| Page | PascalCase | `Dashboard.tsx` | `client/src/pages/` |
| Component | PascalCase | `Modal.tsx` | `client/src/components/` |
| Hook | camelCase + `use` | `useCache.ts` | `client/src/hooks/` |
| Context | PascalCase + `Context` | `AuthContext.tsx` | `client/src/context/` |
| Utility | camelCase | `helpers.ts` | `client/src/utils/` |
| Styles | camelCase | `index.css` | `client/src/` |
| Config | camelCase | `vite.config.ts` | `client/` |

### Warehouse Files

Same conventions as client files, plus:

| Type | Convention | Example | Location |
|------|-----------|---------|----------|
| Types | camelCase | `inventory.ts` | `warehouse/src/types/` |
| Constants | camelCase | `constants.ts` | `warehouse/src/` |

## Variable Naming

### Variables

**Use camelCase** for all variables:

```typescript
// BAD
const Customer_Name = 'John';
const order_id = '123';
const TOTAL_AMOUNT = 100;

// GOOD
const customerName = 'John';
const orderId = '123';
const totalAmount = 100;
```

### Constants

**Use UPPER_SNAKE_CASE** for true constants (values that never change):

```typescript
// BAD
const maxRetries = 3;
const defaultStatus = 'Draft';

// GOOD
const MAX_RETRIES = 3;
const DEFAULT_STATUS = 'Draft';
const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Ordered', 'Cancelled'],
  // ...
};
```

**When to use UPPER_SNAKE_CASE**:
- Configuration values that are truly constant
- Enum-like objects
- Magic numbers that need explanation
- Environment variable names

**When to use camelCase**:
- Variables that might change
- Function parameters
- Function return values
- Object properties

### Boolean Variables

**Use `is`, `has`, `can`, `should` prefixes** for boolean variables:

```typescript
// BAD
const active = true;
const deleted = false;
const verified = true;

// GOOD
const isActive = true;
const isDeleted = false;
const isVerified = true;
const hasPermission = true;
const canEdit = true;
const shouldRefresh = true;
```

### Function Variables

**Use descriptive names** that explain purpose:

```typescript
// BAD
const fn = (x) => x * 2;
const arr = items.filter(i => i.active);
const d = new Date();

// GOOD
const doubleValue = (number) => number * 2;
const activeItems = items.filter(item => item.active);
const currentDate = new Date();
```

## Function Naming

### Verbs for Functions

**Use verb phrases** for functions:

```typescript
// BAD
function customer(id: string) { }
function orderTotal(order: Order) { }
function formatDate(date: Date) { }

// GOOD
function getCustomer(id: string) { }
function calculateOrderTotal(order: Order) { }
function formatDate(date: Date): string { }
```

### Common Verb Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `get` | Retrieve data | `getCustomer()`, `getOrder()` |
| `set` | Set data | `setStatus()`, `setBranch()` |
| `create` | Create new data | `createCustomer()`, `createOrder()` |
| `update` | Update existing data | `updateCustomer()`, `updateOrder()` |
| `delete` | Remove data | `deleteCustomer()`, `deleteOrder()` |
| `find` | Search for data | `findCustomer()`, `findOrders()` |
| `validate` | Validate data | `validateCustomer()`, `validateOrder()` |
| `calculate` | Compute values | `calculateTotal()`, `calculateTax()` |
| `process` | Process data | `processOrder()`, `processPayment()` |
| `send` | Send data | `sendNotification()`, `sendEmail()` |
| `handle` | Handle events | `handleError()`, `handleRequest()` |
| `is` | Check condition | `isActive()`, `isValid()` |
| `has` | Check existence | `hasPermission()`, `hasStock()` |
| `can` | Check capability | `canEdit()`, `canDelete()` |
| `should` | Check necessity | `shouldRefresh()`, `shouldRetry()` |

### Async Functions

**Add `Async` suffix** or use `async/await` naturally:

```typescript
// GOOD
async function getCustomer(id: string): Promise<Customer> { }
async function createOrder(data: OrderInput): Promise<Order> { }
```

### Event Handlers

**Use `handle` prefix** for event handlers:

```typescript
// BAD
function onClick() { }
function onSubmit() { }

// GOOD
function handleClick() { }
function handleSubmit() { }
function handleFormSubmit() { }
```

## Class Naming

### PascalCase for Classes

```typescript
// BAD
class customerController { }
class order_service { }

// GOOD
class CustomerController { }
class OrderService { }
```

### Suffix Conventions

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Controller` | Handle HTTP requests | `CustomerController` |
| `Service` | Business logic | `OrderService` |
| `Repository` | Data access | `CustomerRepository` |
| `Middleware` | Express middleware | `AuthMiddleware` |
| `Handler` | Event handler | `ErrorHandler` |
| `Builder` | Build complex objects | `QueryBuilder` |
| `Factory` | Create objects | `ModelFactory` |
| `Validator` | Validate data | `InputValidator` |
| `Formatter` | Format data | `DateFormatter` |
| `Parser` | Parse data | `JsonParser` |

## Interface Naming

### PascalCase for Interfaces

```typescript
// BAD
interface customer { }
interface order_input { }

// GOOD
interface Customer { }
interface CreateOrderInput { }
interface OrderResponse { }
```

### Suffix Conventions

| Suffix | Purpose | Example |
|--------|---------|---------|
| Input | Create/update input | `CreateCustomerInput` |
| Response | API response | `CustomerResponse` |
| Params | Route parameters | `GetCustomerParams` |
| Query | Query parameters | `ListCustomersQuery` |
| Config | Configuration | `DatabaseConfig` |
| Options | Function options | `CreateOrderOptions` |
| Result | Function result | `CalculateTotalResult` |
| State | Component state | `DashboardState` |
| Props | Component props | `ModalProps` |
| Event | Event object | `ClickEvent` |

## Type Naming

### PascalCase for Types

```typescript
// BAD
type order_status = 'draft' | 'ordered';
type customer_list = Customer[];

// GOOD
type OrderStatus = 'Draft' | 'Ordered' | 'In Lab' | 'Ready' | 'Delivered' | 'Cancelled';
type CustomerList = Customer[];
```

## Enum Naming

### PascalCase for Enums

```typescript
// BAD
enum order_status {
  DRAFT = 'draft',
  ORDERED = 'ordered'
}

// GOOD
enum OrderStatus {
  Draft = 'Draft',
  Ordered = 'Ordered',
  InLab = 'In Lab',
  Ready = 'Ready',
  Delivered = 'Delivered',
  Cancelled = 'Cancelled'
}
```

## Database Naming

### Collections

**Use plural, lowercase, camelCase** for collection names:

```typescript
// BAD
collection: 'customer'
collection: 'order_item'
collection: 'user_permissions'

// GOOD
collection: 'customers'
collection: 'orderItems'
collection: 'userPermissions'
```

### Fields

**Use camelCase** for field names:

```typescript
// BAD
field: 'customer_id'
field: 'order_date'
field: 'total_amount'

// GOOD
field: 'customerId'
field: 'orderDate'
field: 'totalAmount'
```

### Indexes

**Use descriptive names** for indexes:

```typescript
// BAD
index: { field: 1 }

// GOOD
// Mongoose auto-generates index names, but document the purpose
customerSchema.index({ mobile: 1 }); // For mobile lookup
customerSchema.index({ customerId: 1 }); // For customerId lookup
orderSchema.index({ customerId: 1, createdAt: -1 }); // For customer order history
```

## API Naming

### Endpoints

**Use plural nouns** for resource endpoints:

```typescript
// BAD
GET /api/customer
GET /api/order-item
POST /api/createCustomer

// GOOD
GET /api/customers
GET /api/orderItems
POST /api/customers
```

### Query Parameters

**Use camelCase** for query parameters:

```typescript
// BAD
GET /api/customers?page_size=20&search_term=john

// GOOD
GET /api/customers?limit=20&search=john
```

### Response Fields

**Use camelCase** for response fields:

```typescript
// BAD
{
  "customer_id": "123",
  "total_amount": 100,
  "created_at": "2024-01-01"
}

// GOOD
{
  "customerId": "123",
  "totalAmount": 100,
  "createdAt": "2024-01-01"
}
```

## Environment Variables

### UPPER_SNAKE_CASE for Environment Variables

```bash
# BAD
mongo_uri=mongodb://localhost:27017/kmj-erp
jwt_secret=my-secret

# GOOD
MONGO_URI=mongodb://localhost:27017/kmj-erp
JWT_SECRET=my-secret
PORT=4000
NODE_ENV=development
```

## CSS Naming

### Tailwind Classes

**Use Tailwind utility classes** directly:

```html
<!-- BAD -->
<div class="customer-card">
  <h2 class="customer-name">John</h2>
</div>

<!-- GOOD -->
<div class="bg-white rounded-lg shadow-md p-4">
  <h2 class="text-xl font-bold text-gray-900">John</h2>
</div>
```

### CSS Custom Properties

**Use `--` prefix** for CSS custom properties:

```css
/* BAD */
:root {
  primary-color: #1ed760;
}

/* GOOD */
:root {
  --primary-color: #1ed760;
}
```

### Tailwind Theme Tokens

**Use `th-` prefix** for theme tokens:

```css
/* BAD */
.primary { color: var(--primary-color); }

/* GOOD */
.th-primary { color: var(--th-primary); }
```

## Git Branch Naming

### Convention

```
<type>/<short-description>
```

### Types

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat/add-customer-notes` |
| `fix` | Bug fix | `fix/order-status-transition` |
| `refactor` | Code refactoring | `refactor/extract-payment-service` |
| `docs` | Documentation | `docs/update-api-documentation` |
| `test` | Tests | `test/add-order-integration-tests` |
| `chore` | Maintenance | `chore/update-dependencies` |
| `perf` | Performance | `perf/optimize-dashboard-queries` |
| `security` | Security fix | `fix/xss-in-search` |

### Examples

```bash
git checkout -b feat/add-customer-tags
git checkout -b fix/bill-number-collision
git checkout -b refactor/extract-order-service
git checkout -b docs/update-readme
git checkout -b test/add-payment-tests
git checkout -b chore/update-deps
git checkout -b perf/optimize-inventory-query
git checkout -b security/fix-regex-injection
```

## Commit Message Naming

### Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples

```bash
feat(customers): add customer tags support

- Add tags field to customer model
- Add tag filtering to customer list
- Add tag management to customer detail

Closes #123

fix(orders): fix status transition validation

The order status transition from Draft to Delivered was incorrectly
allowed. This fix ensures only valid transitions are permitted.

Ref: AGENTS.md#order-status-transitions

refactor(bills): extract bill calculation service

Extract bill calculation logic from route handler into a dedicated
service for better testability and reuse.

Breaking change: None
```

## Anti-Patterns

### 1. Inconsistent Naming

```typescript
// BAD
const customerName = 'John';
const order_date = '2024-01-01';
const TOTAL_AMOUNT = 100;

// GOOD
const customerName = 'John';
const orderDate = '2024-01-01';
const totalAmount = 100;
```

### 2. Abbreviations

```typescript
// BAD
const cust = getCustomer();
const ord = getOrder();
const fn = (x) => x * 2;

// GOOD
const customer = getCustomer();
const order = getOrder();
const doubleValue = (number) => number * 2;
```

### 3. Hungarian Notation

```typescript
// BAD
const strName = 'John';
const intAge = 25;
const boolActive = true;

// GOOD
const name = 'John';
const age = 25;
const isActive = true;
```

### 4. Prefixes for Types

```typescript
// BAD
interface ICustomer { }
class CCustomerController { }

// GOOD
interface Customer { }
class CustomerController { }
```

### 5. Plural for Single Items

```typescript
// BAD
const customers = getCustomer(); // Returns single customer
const orders = getOrder(); // Returns single order

// GOOD
const customer = getCustomer();
const order = getOrder();
```

## Cross-References

- **Coding standards**: See `docs/05-coding-standards.md`
- **Folder structure**: See `docs/04-folder-structure.md`
- **TypeScript standards**: See `docs/05-coding-standards.md#typescript-standards`

## AI Instructions

When working on this project:
1. Follow these naming conventions exactly
2. Don't use abbreviations
3. Don't use Hungarian notation
4. Don't use inconsistent naming
5. Always use descriptive names
6. Always use consistent casing
7. Always follow the suffix conventions
8. Always use verb phrases for functions
9. Always use `is`/`has`/`can`/`should` for booleans
10. Always run linting after changes
