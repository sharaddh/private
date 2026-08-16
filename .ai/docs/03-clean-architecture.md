# 03 - Clean Architecture

## Purpose

This document defines the architectural patterns used in the KMJ Optical ERP system. It explains the layered architecture, dependency flow, and separation of concerns that govern the codebase.

## Architecture Overview

### Layered Architecture

The KMJ Optical ERP follows a modified layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                         │
│  React Components → Pages → Layout → App                     │
│  (client/src/)                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                  │
│  Express Routes → Middleware Chain → Response Formatting      │
│  (server/src/routes/)                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                       │
│  Controllers → Services → Business Rules                     │
│  (server/src/controllers/, server/src/services/)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                          │
│  Mongoose Models → Schema Definitions → Query Building       │
│  (server/src/models/)                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                 │
│  MongoDB Databases → Collections → Documents                 │
│  (External)                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Flow

Dependencies flow downward only:

```
Presentation → API → Business Logic → Data Access → Data
```

**Never**:
- Business Logic → Presentation
- Data Access → Business Logic
- API → Presentation
- Data → Data Access

## Layer Definitions

### 1. Presentation Layer (Client)

**Location**: `client/src/`, `warehouse/src/`

**Responsibilities**:
- Render UI components
- Handle user interactions
- Manage client-side state
- Make API calls
- Display data to users

**Rules**:
- Never contain business logic
- Never directly access database
- Never handle authentication
- Never validate data on server side
- Always use the API layer for data access

**Example**:
```typescript
// GOOD: Presentation layer only handles UI concerns
const CustomerDetail = ({ customerId }) => {
  const [customer, setCustomer] = useState(null);
  
  useEffect(() => {
    api.get(`/api/customers/${customerId}`).then(res => {
      if (res.success) setCustomer(res.data);
    });
  }, [customerId]);
  
  if (!customer) return <LoadingSpinner />;
  
  return (
    <div>
      <h1>{customer.name}</h1>
      <p>{customer.mobile}</p>
      {/* Render customer details */}
    </div>
  );
};
```

**Anti-pattern**:
```typescript
// BAD: Business logic in presentation layer
const CustomerDetail = ({ customerId }) => {
  const [customer, setCustomer] = useState(null);
  
  useEffect(() => {
    // Business logic in presentation layer - WRONG!
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
    const pendingAmount = bills.reduce((sum, bill) => sum + bill.pendingAmount, 0);
    setCustomer({ ...customerData, totalSpent, pendingAmount });
  }, [customerId]);
};
```

### 2. API Layer (Routes)

**Location**: `server/src/routes/`

**Responsibilities**:
- Handle HTTP requests and responses
- Apply middleware (authentication, authorization, caching, validation)
- Parse request parameters
- Format response data
- Delegate business logic to controllers/services

**Rules**:
- Never contain business logic
- Always apply appropriate middleware
- Always validate inputs
- Always handle errors
- Always use consistent response format

**Example**:
```typescript
// GOOD: API layer handles HTTP concerns only
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  // Parse query parameters
  const { page = 1, limit = 20, search } = req.query;
  
  // Delegate to data access layer
  const customers = await req.branchModels.Customer.find()
    .skip((page - 1) * limit)
    .limit(limit);
  
  // Format response
  res.json(success(customers));
}));
```

**Anti-pattern**:
```typescript
// BAD: Business logic in API layer
router.get('/', async (req, res) => {
  // Business logic in API layer - WRONG!
  const customers = await Customer.find();
  const enriched = customers.map(c => ({
    ...c,
    lifetimeValue: calculateLifetimeValue(c),
    riskScore: calculateRiskScore(c)
  }));
  res.json(enriched);
});
```

### 3. Business Logic Layer (Controllers/Services)

**Location**: `server/src/controllers/`, `server/src/services/`

**Responsibilities**:
- Implement business rules
- Coordinate between multiple data sources
- Handle complex workflows
- Enforce business constraints
- Manage transactions

**Rules**:
- Never handle HTTP concerns
- Never format responses
- Always validate business rules
- Always handle errors gracefully
- Always document business rules

**Example**:
```typescript
// GOOD: Business logic layer implements business rules
const createOrder = async (orderData: CreateOrderInput) => {
  // Business rule: Validate customer exists
  const customer = await Customer.findById(orderData.customerId);
  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }
  
  // Business rule: Calculate total
  const total = calculateOrderTotal(orderData);
  
  // Business rule: Create order
  const order = await Order.create({
    ...orderData,
    total,
    status: 'Draft'
  });
  
  return order;
};

// Business rule: Order total calculation
const calculateOrderTotal = (order: CreateOrderInput) => {
  return order.framePrice + order.lensPrice + order.coatingPrice + 
    (order.accessories?.reduce((sum, acc) => sum + (inventoryMap.get(acc)?.sellingPrice || 0), 0) || 0);
};
```

### 4. Data Access Layer (Models)

**Location**: `server/src/models/`

**Responsibilities**:
- Define data schemas
- Define data relationships
- Define indexes
- Provide query methods
- Handle data validation at database level

**Rules**:
- Never contain business logic
- Never handle HTTP concerns
- Always define proper schemas
- Always define proper indexes
- Always handle database errors

**Example**:
```typescript
// GOOD: Data access layer defines schemas and queries
const orderSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  status: { type: String, enum: ['Draft', 'Ordered', 'In Lab', 'Ready', 'Delivered', 'Cancelled'], default: 'Draft' },
  framePrice: { type: Number, default: 0 },
  lensPrice: { type: Number, default: 0 },
  coatingPrice: { type: Number, default: 0 }
}, { timestamps: true });

// Compound indexes for common queries
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
```

## Multi-Tenant Architecture

### Branch-Based Data Isolation

The system uses a database-per-branch architecture for data isolation:

```
Root Database (kmj)
├── Users
├── Branches
└── WhatsApp Auth (baileys_auth_*)

Branch Database (kmj_govindpuri)
├── Customers
├── Visits
├── Prescriptions
├── Orders
├── Bills
├── Payments
├── Inventory
├── Deliveries
├── Settings
└── Todos

Branch Database (kmj_falke_bajar)
├── Customers
├── Visits
├── Prescriptions
├── Orders
├── Bills
├── Payments
├── Inventory
├── Deliveries
├── Settings
└── Todos
```

### Branch Model Proxy System

The branch model proxy system provides transparent data routing:

```
Request arrives with x-branch-id header
     │
     ▼
branchScope middleware validates branch
     │
     ▼
Creates BranchModels instance for branch database
     │
     ▼
Stores in AsyncLocalStorage context
     │
     ▼
All model operations automatically route to correct database
     │
     ▼
Code doesn't need to know about branch routing
```

**Example**:
```typescript
// This code works the same regardless of which branch is active
const customers = await Customer.find();
// The Proxy intercepts this and routes to the correct branch database
```

### Why This Architecture?

1. **Data isolation**: Each branch's data is completely isolated
2. **Transparent routing**: Business logic doesn't need to know about branches
3. **Scalability**: Each branch database can be scaled independently
4. **Security**: Branch data cannot leak between branches
5. **Maintainability**: Business logic code is branch-agnostic

## Middleware Chain

### Request Processing Pipeline

```
Request
  │
  ▼
helmet (security headers)
  │
  ▼
cors (cross-origin)
  │
  ▼
compression (gzip)
  │
  ▼
express.json (body parsing)
  │
  ▼
pino-http (logging)
  │
  ▼
audit (audit logging)
  │
  ▼
rateLimit (rate limiting)
  │
  ▼
Route-specific middleware:
  ├── authenticate (JWT verification)
  ├── branchScope (branch routing)
  ├── cacheRoute (response caching)
  ├── requireRole (role-based access)
  └── audit (selective audit logging)
  │
  ▼
Route handler
  │
  ▼
Response
  │
  ▼
errorHandler (error handling)
```

### Middleware Responsibilities

| Middleware | Responsibility | Layer |
|-----------|---------------|-------|
| helmet | Security headers | Infrastructure |
| cors | Cross-origin requests | Infrastructure |
| compression | Response compression | Infrastructure |
| express.json | Body parsing | Infrastructure |
| pino-http | Request logging | Infrastructure |
| audit | Audit logging | Infrastructure |
| rateLimit | Rate limiting | Infrastructure |
| authenticate | JWT verification | Security |
| branchScope | Branch routing | Data Access |
| cacheRoute | Response caching | Performance |
| requireRole | Role-based access | Security |

## Error Handling Architecture

### Error Flow

```
Error occurs in route handler
  │
  ▼
asyncHandler catches rejected promise
  │
  ▼
Error forwarded to next() middleware
  │
  ▼
errorHandler receives error
  │
  ▼
Error type determined:
  ├── AppError → Custom status code and message
  ├── ValidationError → 400 with validation details
  ├── CastError → 400 with "Invalid ID format"
  ├── DuplicateKey (11000) → 409 with "Duplicate entry"
  └── Unknown → 500 with "Internal Server Error"
  │
  ▼
Error response sent:
  { success: false, message: "Error message" }
```

### Error Types

| Error Type | HTTP Status | Description |
|-----------|-------------|-------------|
| AppError | Custom | Business logic errors |
| ValidationError | 400 | Mongoose validation errors |
| CastError | 400 | Invalid ObjectId format |
| DuplicateKey | 409 | Unique constraint violation |
| Unknown | 500 | Unexpected errors |

## Caching Architecture

### Cache Layers

```
Request
  │
  ▼
Redis Cache (optional)
  ├── Cache HIT → Return cached response
  └── Cache MISS → Continue to route handler
  │
  ▼
Route Handler
  │
  ▼
Response cached in Redis
  │
  ▼
Response sent to client
```

### Cache Invalidation

```
Mutation occurs (POST/PUT/DELETE)
  │
  ▼
Route handler processes mutation
  │
  ▼
invalidateCache() called for affected routes
  │
  ▼
Redis keys matching pattern deleted
  │
  ▼
Next request will be cache MISS
```

### Cache TTL Strategy

| Data Type | TTL | Reasoning |
|-----------|-----|-----------|
| Dashboard | 30s | Changes frequently |
| Orders | 30s | Changes frequently |
| Bills | 30s | Changes frequently |
| Payments | 30s | Changes frequently |
| Customers | 60s | Changes less frequently |
| Inventory | 60s | Changes less frequently |
| Reports | 60-120s | Computed, changes infrequently |

## Tradeoffs

### Chosen Patterns

1. **Database-per-branch** vs **Shared database with branch field**
   - Chosen: Database-per-branch
   - Tradeoff: More complex, but better isolation and scalability

2. **Proxy-based routing** vs **Explicit branch parameter**
   - Chosen: Proxy-based routing
   - Tradeoff: More magic, but transparent to business logic

3. **Middleware chain** vs **Decorator pattern**
   - Chosen: Middleware chain
   - Tradeoff: More explicit, but more boilerplate

4. **Express** vs **NestJS/Fastify**
   - Chosen: Express
   - Tradeoff: Less features, but simpler and more familiar

5. **Mongoose** vs **Prisma/TypeORM**
   - Chosen: Mongoose
   - Tradeoff: Less type safety, but better MongoDB integration

### What We Sacrificed

1. **Type safety**: Mongoose schemas are not fully typed
2. **Testability**: Some business logic is in route files
3. **Reusability**: Some business logic is not extracted to services
4. **Performance**: Proxy adds overhead to every model operation
5. **Scalability**: Single-process server limits horizontal scaling

### What We Gained

1. **Simplicity**: Easy to understand and modify
2. **Transparency**: Branch routing is invisible to business logic
3. **Flexibility**: Easy to add new branches
4. **Isolation**: Branch data is completely isolated
5. **Maintainability**: Clear separation of concerns

## Cross-References

- **Folder structure**: See `docs/04-folder-structure.md`
- **Backend architecture**: See `docs/07-backend.md`
- **Database architecture**: See `docs/12-database.md`
- **API design**: See `docs/14-api-design.md`
- **Caching**: See `docs/24-caching.md`
- **Performance**: See `docs/21-performance.md`

## AI Instructions

When working on this project:
1. Understand the layered architecture before making changes
2. Respect the dependency flow (downward only)
3. Don't put business logic in the wrong layer
4. Don't bypass middleware without good reason
5. Don't break the branch routing system
6. Always consider the impact on all layers
