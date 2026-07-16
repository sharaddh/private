# 33 - Documentation

## Purpose

This document defines documentation standards for the KMJ Optical ERP project, including inline comments, API documentation, architecture documentation, README files, and changelogs. Good documentation is essential for maintainability and onboarding.

## Core Principles

1. **Documentation as code**: Documentation lives with the code it describes.
2. **Accurate and current**: Documentation must reflect the current state of the code.
3. **Audience-aware**: Write for the reader (developer, operator, stakeholder).
4. **Searchable**: Use consistent structure and naming for findability.
5. **Minimal but sufficient**: Document enough to understand, not more.

## Detailed Rules

### Inline Comments

#### When to Comment

**Always comment**:
1. Complex business logic
2. Non-obvious algorithms
3. Workarounds and hacks (with explanation)
4. External API integrations
5. Security-sensitive code
6. Performance-critical code
7. Regulatory compliance requirements

**Never comment**:
1. Obvious code (comment explains what, not why)
2. Variable declarations (`let count = 0;`)
3. Simple getters/setters
4. Self-documenting function names

#### Comment Style

```typescript
// GOOD: Explains WHY, not WHAT
// Business rule: Customer mobile must be unique per branch
// This prevents duplicate customer records across branches
const existing = await Customer.findOne({ mobile: data.mobile });
if (existing) {
  throw new AppError(409, 'Customer with this mobile already exists');
}

// GOOD: Documents complex logic
/**
 * Calculates the order total including frame, lens, coating, and accessories.
 *
 * Business rules:
 * - Frame price is fixed from inventory
 * - Lens price depends on type, index, and brand
 * - Coating price is additive
 * - Accessory prices are looked up from inventory by SKU
 * - If an accessory SKU is not found, its price defaults to 0
 *
 * @see knowledge/business-domains.md#order-pricing
 */
function calculateOrderTotal(order: Order): number {
  // ...
}

// BAD: Explains WHAT (obvious from code)
// Get customer by ID
const customer = await Customer.findById(id);

// BAD: Outdated comment
// Returns list of customers (actually returns paginated results now)
const customers = await Customer.find().skip(skip).limit(limit);
```

### API Documentation

#### Endpoint Documentation

Every API endpoint must have documentation:

```typescript
/**
 * GET /api/customers
 *
 * List all customers for the current branch.
 *
 * Authentication: Required (JWT)
 * Authorization: staff, owner
 * Branch Scope: Required (x-branch-id header)
 *
 * Query Parameters:
 * - page (number, default 1): Page number
 * - limit (number, default 20): Items per page (max 100)
 * - search (string): Search by name or mobile
 * - sort (string, default 'createdAt:-1'): Sort field and direction
 *
 * Response (200):
 * {
 *   success: true,
 *   data: Customer[],
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     total: number,
 *     pages: number
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not authorized
 * - 404: Branch not found
 *
 * @see docs/07-backend.md#route-standards
 */
router.get('/', authenticate, branchScope, cacheRoute(60), asyncHandler(async (req, res) => {
  // ...
}));
```

#### Schema Documentation

Document all schema fields:

```typescript
const customerSchema = new Schema({
  // Unique identifier (auto-generated)
  customerId: { type: String, index: true },

  // Customer full name (required)
  name: { type: String, required: true, index: true },

  // Primary mobile number (used for WhatsApp)
  mobile: { type: String, index: true },

  // Alternate contact number (optional)
  alternateMobile: { type: String },

  // Denormalized: Total number of visits
  // Updated atomically via $inc on visit creation
  totalVisits: { type: Number, default: 0 },

  // Denormalized: Total amount spent (INR)
  // Updated atomically via $inc on payment
  totalSpent: { type: Number, default: 0, index: { totalSpent: -1 } },

  // Denormalized: Current pending amount (INR)
  // Updated atomically via $inc on payment/bill
  pendingAmount: { type: Number, default: 0 },
}, { timestamps: true });
```

### Architecture Documentation

#### System Architecture

Maintain a system architecture document:

```markdown
# System Architecture

## Overview

The KMJ Optical ERP consists of three applications:

1. **Main ERP Client** (React, Port 5173)
2. **Warehouse App** (React, Port 5174)
3. **Backend API** (Express, Port 4000)

## Data Flow

1. Client sends request to Backend API
2. Backend API authenticates request
3. Backend API routes to branch database
4. Backend API processes business logic
5. Backend API returns response
6. Client updates UI

## Database Architecture

- Root database: Users and branches
- Branch databases: Business data per branch
- Redis: Optional caching layer

## External Integrations

- WhatsApp (Baileys): Customer notifications
- MongoDB Atlas: Primary database
- Render.com: Application hosting
```

#### Component Architecture

Document component relationships:

```markdown
## Backend Components

### Middleware Layer
- authenticate: JWT verification
- branchScope: Branch routing
- cacheRoute: Response caching
- requireRole: Role-based access
- audit: Audit logging

### Controller Layer
- CustomerController: Customer CRUD
- OrderController: Order management
- BillController: Billing operations
- PaymentController: Payment processing

### Service Layer
- CacheService: Redis caching
- WhatsAppService: Message delivery
- PDFService: PDF generation
- QRService: QR code generation

### Model Layer
- Customer: Customer data
- Order: Order data
- Bill: Billing data
- Payment: Payment data
```

### README Files

#### Project README

```markdown
# KMJ Optical ERP

Multi-branch optical retail ERP system.

## Features

- Customer management
- Order processing
- Billing and invoicing
- Payment tracking
- Inventory management
- Delivery tracking
- WhatsApp notifications
- Multi-branch support

## Tech Stack

- Backend: Express.js, TypeScript, MongoDB
- Frontend: React, TypeScript, Tailwind CSS
- Database: MongoDB (Mongoose ODM)
- Cache: Redis (optional)
- WhatsApp: Baileys
- PDF: PDFKit
- QR: qrcode

## Getting Started

### Prerequisites
- Node.js 16+
- MongoDB 5+
- Redis (optional)

### Installation
npm install

### Development
npm run dev

### Production
npm run build
npm start
```

#### Component README

```markdown
# Customer Management

## Overview

The customer management module handles customer CRUD operations,
visit tracking, and customer relationship management.

## API Endpoints

- GET /api/customers - List customers
- POST /api/customers - Create customer
- GET /api/customers/:id - Get customer
- PUT /api/customers/:id - Update customer
- DELETE /api/customers/:id - Delete customer
- GET /api/customers/:id/visits - Get customer visits

## Business Rules

- Customer mobile must be unique per branch
- Customer name is required
- Total visits and spent are denormalized
- Pending amount tracks outstanding balance

## Related Documentation

- See docs/07-backend.md for backend standards
- See docs/12-database.md for database patterns
```

### Changelog

#### Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Customer notes feature
- Visit history endpoint

### Changed
- Improved order status validation

### Fixed
- Payment calculation edge case

### Removed
- None

## [1.2.0] - 2024-01-15

### Added
- Multi-branch support
- WhatsApp integration
- PDF generation

### Changed
- Migrated from REST to typed API

### Fixed
- Customer duplicate detection
```

#### Rules

1. **Always update CHANGELOG** for user-facing changes
2. **Use Keep a Changelog format** for consistency
3. **Group by type** (Added, Changed, Fixed, Removed)
4. **Include issue references** when applicable
5. **Date releases** in YYYY-MM-DD format

### Documentation Maintenance

#### When to Update

1. **New feature**: Add to README, add API docs, add architecture docs
2. **API change**: Update API documentation
3. **Schema change**: Update schema documentation
4. **Architecture change**: Update architecture docs
5. **Bug fix**: Update changelog
6. **Breaking change**: Update migration guide

#### Review Process

1. **Author updates documentation** with code changes
2. **Reviewer verifies documentation** is accurate
3. **Documentation Engineer reviews** for consistency
4. **Merge documentation** with code changes

## Bad Examples

```typescript
// BAD: Outdated comment
// Returns list of customers
async function getCustomers(page: number, limit: number) {
  // Actually returns paginated results
  // Comment is misleading
}

// BAD: No documentation
router.post('/orders', authenticate, branchScope, asyncHandler(async (req, res) => {
  // No documentation for this endpoint
  // What does it do? What are the parameters? What does it return?
}));

// BAD: Wrong documentation
/**
 * GET /api/customers
 * Returns all customers (no pagination)
 */
router.get('/', asyncHandler(async (req, res) => {
  // Actually supports pagination
}));
```

## Good Examples

```typescript
// GOOD: Accurate, helpful comment
// Business rule: Order status transitions must follow the pipeline
// Draft → Ordered → In Lab → Ready → Delivered
// Any status can transition to Cancelled
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Draft: ['Ordered', 'Cancelled'],
  Ordered: ['In Lab', 'Cancelled'],
  'In Lab': ['Ready', 'Cancelled'],
  Ready: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

// GOOD: Complete API documentation
/**
 * POST /api/orders
 *
 * Create a new order for a customer.
 *
 * Authentication: Required (JWT)
 * Authorization: staff, owner
 * Branch Scope: Required
 *
 * Request Body:
 * - customerId (string, required): Customer ID
 * - frame (string): Frame type
 * - lens (string): Lens type
 * - framePrice (number): Frame price
 * - lensPrice (number): Lens price
 *
 * Response (201):
 * {
 *   success: true,
 *   data: Order
 * }
 *
 * Errors:
 * - 400: Validation error
 * - 401: Not authenticated
 * - 404: Customer not found
 */
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Inline comments | Contextual understanding | Can become outdated |
| API documentation | Clear contracts | More code to maintain |
| Architecture docs | System understanding | Requires updates |
| README files | Onboarding | Must stay current |
| Changelog | Release tracking | Requires discipline |

## Cross-References

- **Coding standards**: See `docs/05-coding-standards.md`
- **API design**: See `docs/14-api-design.md`
- **Architecture**: See `docs/03-clean-architecture.md`
- **Git workflow**: See `docs/31-git-workflow.md`
- **Code review**: See `docs/30-code-review.md`

## AI Instructions

When writing documentation:
1. Always document complex business logic
2. Always document API endpoints
3. Always document schema fields
4. Always update documentation with code changes
5. Always verify documentation is accurate
6. Never document obvious code
7. Never leave outdated comments
8. Always use consistent formatting
9. Always reference related documentation
10. Always review documentation before merging
