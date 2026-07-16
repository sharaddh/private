# KMJ Optical ERP — Architecture Map

> Complete system architecture documentation with diagrams, component interactions,
> database relationships, API mappings, middleware chains, and architectural decisions.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Application Architecture](#2-application-architecture)
3. [Database Architecture](#3-database-architecture)
4. [API Endpoint Mapping](#4-api-endpoint-mapping)
5. [Middleware Chain](#5-middleware-chain)
6. [Component Interaction Diagrams](#6-component-interaction-diagrams)
7. [Caching Architecture](#7-caching-architecture)
8. [WhatsApp Architecture](#8-whatsapp-architecture)
9. [Multi-Tenant Architecture](#9-multi-tenant-architecture)
10. [Architectural Decisions](#10-architectural-decisions)
11. [Security Architecture](#11-security-architecture)
12. [Deployment Architecture](#12-deployment-architecture)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   Client App      │  │  Warehouse App   │                 │
│  │  (React + Vite)   │  │  (React + Vite)  │                 │
│  │  Port 5173        │  │  Port 5174       │                 │
│  │  27 pages         │  │  5 pages         │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                      │                            │
│           └──────────┬───────────┘                            │
│                      │ HTTP/REST                              │
└──────────────────────┼───────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────┐
│                  SERVER (Express)                             │
│                      │                                       │
│  ┌───────────────────┴───────────────────────┐               │
│  │           Middleware Pipeline              │               │
│  │  Helmet → CORS → Compression → JSON       │               │
│  │  → Morgan → Audit → RateLimit             │               │
│  └───────────────────┬───────────────────────┘               │
│                      │                                       │
│  ┌───────────────────┴───────────────────────┐               │
│  │              Route Router                  │               │
│  │  /api/auth, /api/customers, /api/orders   │               │
│  │  /api/bills, /api/payments, etc.          │               │
│  └───────────┬──────────┬──────────┬─────────┘               │
│              │          │          │                          │
│  ┌───────────┴──┐ ┌────┴─────┐ ┌─┴──────────┐              │
│  │  BranchScope  │ │   Auth   │ │   Cache     │              │
│  │  Middleware   │ │Middleware│ │  Middleware  │              │
│  └──────┬──────┘ └────┬─────┘ └─┬──────────┘              │
│         │             │          │                           │
│  ┌──────┴─────────────┴──────────┴───────────┐              │
│  │           Route Handlers                    │              │
│  │  Business Logic + Data Access               │              │
│  └──────────┬──────────┬──────────┬───────────┘              │
│             │          │          │                           │
│  ┌──────────┴──┐ ┌────┴─────┐ ┌─┴──────────┐              │
│  │   Models     │ │Services  │ │   Utils     │              │
│  │ (Mongoose)   │ │(WA,Cache)│ │(PDF,Phone)  │              │
│  └──────┬──────┘ └────┬─────┘ └────────────┘              │
│         │             │                                     │
└─────────┼─────────────┼─────────────────────────────────────┘
          │             │
┌─────────┼─────────────┼─────────────────────────────────────┐
│    ┌────┴────┐  ┌─────┴──────┐  ┌────────────┐             │
│    │ MongoDB │  │   Redis    │  │  WhatsApp   │             │
│    │ (Mongoose)│ │(ioredis)  │  │  (Baileys)  │             │
│    │         │  │  Optional  │  │  Per-Branch  │             │
│    └─────────┘  └────────────┘  └─────────────┘             │
│                       EXTERNAL SERVICES                      │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite + Tailwind | 18.2.0 / 4.5 / 3.3.5 |
| Backend | Node.js + Express + TypeScript | 4.18.2 / 5.2.2 |
| Database | MongoDB (Mongoose ODM) | 7.5.0 |
| Cache | Redis (ioredis) — optional | 5.11.1 |
| Auth | JWT (jsonwebtoken) | 9.0.0 |
| WhatsApp | Baileys (WhatsApp Web protocol) | 6.17.16 |
| PDF | PDFKit (server), jsPDF (client) | 0.19.1 / 4.2.1 |

---

## 2. Application Architecture

### 2.1 Three-Application Architecture

```
┌─────────────────────────────────────────────────┐
│                   Monorepo                       │
│                                                  │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   server/    │ │ client/  │ │  warehouse/  │ │
│  │              │ │          │ │              │ │
│  │  Express API │ │ React SPA│ │ React SPA    │ │
│  │  + Static    │ │          │ │              │ │
│  │  File Serving│ │ Port 5173│ │ Port 5174    │ │
│  │  Port 4000   │ │          │ │              │ │
│  └──────────────┘ └──────────┘ └──────────────┘ │
│                                                  │
│  Root package.json orchestrates all three        │
│  via concurrently for parallel dev               │
└─────────────────────────────────────────────────┘
```

### 2.2 Server Internal Architecture

```
server/src/
├── index.ts              # Entry point: MongoDB connect, seed, WhatsApp init, start
├── app.ts                # Express app: middleware, routes, static serving, SPA fallback
├── config.ts             # Environment variable configuration
│
├── routes/               # API route definitions
│   ├── index.ts          # Route mounting with branchScope middleware
│   ├── auth.ts           # Authentication routes
│   ├── customers.ts      # Customer CRUD
│   ├── visits.ts         # Visit CRUD
│   ├── prescriptions.ts  # Prescription CRUD
│   ├── orders.ts         # Order CRUD + status + classification + demand list
│   ├── bills.ts          # Bill CRUD + WhatsApp notification
│   ├── payments.ts       # Payment CRUD + bill reconciliation
│   ├── inventory.ts      # Inventory CRUD + QR + stats
│   ├── delivery.ts       # Delivery read (status updated by orders)
│   ├── workspace.ts      # Atomic transaction endpoint
│   ├── dashboard.ts      # Dashboard aggregation
│   ├── reports.ts        # Report aggregations
│   ├── settings.ts       # Settings get/update
│   ├── whatsapp.ts       # WhatsApp management
│   ├── branches.ts       # Branch CRUD
│   ├── todos.ts          # Todo CRUD
│   ├── cache-admin.ts    # Cache management
│   └── recalculate.ts    # Data recalculation
│
├── controllers/          # Business logic (extracted from routes)
│   ├── authController.ts # Auth logic (register, login, refresh, etc.)
│   ├── customerController.ts # Customer CRUD logic
│   └── todoController.ts # Todo CRUD logic
│
├── models/               # Mongoose schemas and models
│   ├── db.ts             # Branch-scoped model factory with connection caching
│   ├── customer.ts       # Customer schema (with withBranch proxy)
│   ├── visit.ts          # Visit schema
│   ├── prescription.ts   # Prescription schema (nested eye objects)
│   ├── order.ts          # Order schema (complex, many fields)
│   ├── bill.ts           # Bill schema (with BillItem sub-schema)
│   ├── payment.ts        # Payment schema
│   ├── inventory.ts      # Inventory schema
│   ├── delivery.ts       # Delivery schema
│   ├── settings.ts       # Settings schema
│   ├── todo.ts           # Todo schema
│   ├── user.ts           # User schema (global, not branch-scoped)
│   └── branch.ts         # Branch schema (global, not branch-scoped)
│
├── middleware/            # Express middleware
│   ├── auth.ts           # JWT verification
│   ├── branch.ts         # Branch scope resolution
│   ├── cache.ts          # Route caching (Redis-backed)
│   ├── audit.ts          # Request logging
│   ├── errorHandler.ts   # Centralized error handling
│   └── asyncHandler.ts   # Async error wrapper
│
├── services/             # External service integrations
│   ├── whatsapp.ts       # WhatsApp Baileys service (640 lines)
│   └── cache.ts          # Redis cache service
│
├── utils/                # Utility functions
│   ├── jwt.ts            # JWT sign/verify
│   ├── phone.ts          # Phone normalization
│   ├── pdf.ts            # Bill PDF generation
│   ├── response.ts       # Standardized API responses
│   ├── requestContext.ts # AsyncLocalStorage for branch context
│   └── branchProxy.ts    # Transparent branch model proxy
│
├── scripts/              # One-time scripts
│   ├── recalculate-customers.ts
│   ├── migrate-branches.ts
│   ├── fix-branch-migration.ts
│   └── clear-falka.ts
│
└── migrations/
    └── migrate-legacy.ts
```

### 2.3 Client Internal Architecture

```
client/src/
├── main.tsx              # Entry point
├── App.tsx               # Route definitions (lazy-loaded)
├── api.ts                # API client (fetch wrapper)
│
├── pages/                # Page components (one per route)
│   ├── Dashboard.tsx
│   ├── Customers.tsx
│   ├── CustomerDetail.tsx
│   ├── CustomerNewVisit/
│   │   ├── index.tsx
│   │   └── CustomerNewVisit.tsx
│   ├── NewVisit.tsx
│   ├── Orders.tsx
│   ├── Bills.tsx
│   ├── Payments.tsx
│   ├── InventoryPage.tsx
│   ├── Delivery.tsx
│   ├── Pickup.tsx
│   ├── ItemScan.tsx
│   ├── Reports.tsx
│   ├── Settings.tsx
│   ├── WhatsApp.tsx
│   ├── Workspace.tsx
│   ├── Announcement.tsx
│   ├── Login.tsx
│   ├── StaffLogin.tsx
│   └── Register.tsx
│
├── components/
│   ├── Layout.tsx        # App shell (sidebar, header)
│   ├── Modal.tsx         # Reusable modal
│   ├── Table.tsx         # Reusable table
│   ├── Form.tsx          # Reusable form
│   ├── StatCard.tsx      # Dashboard stat card
│   ├── Skeleton.tsx      # Loading skeleton
│   ├── Toast.tsx         # Toast notification
│   ├── RoleGuard.tsx     # Role-based access guard
│   ├── CameraScanner.tsx # QR code camera scanner
│   ├── DateRangePicker.tsx
│   ├── DashboardCharts.tsx
│   ├── errors/
│   │   ├── ErrorBoundary.tsx
│   │   └── PageLoader.tsx
│   ├── NewvistePage/     # New Visit wizard components
│   │   ├── VisitStepper.tsx
│   │   ├── VisitTypeSection.tsx
│   │   ├── PrescriptionPanel.tsx
│   │   ├── OrderItems.tsx
│   │   ├── BillingPanel.tsx
│   │   ├── PaymentPanel.tsx
│   │   ├── ConfirmationDashboard.tsx
│   │   ├── BottomNav.tsx
│   │   └── PageHeader.tsx
│   └── settings/
│       ├── ThemeToggle.tsx
│       ├── SettingsHeader.tsx
│       ├── SectionNav.tsx
│       ├── SectionCard.tsx
│       └── FormField.tsx
│
├── context/
│   ├── AppProviders.tsx  # Combined context providers
│   ├── AuthContext.tsx    # Authentication state
│   ├── ToastContext.tsx   # Toast notifications
│   ├── ThemeContext.tsx   # Dark/light theme
│   └── TranslateContext.tsx # i18n
│
├── hooks/
│   ├── useApi.ts         # API call hook
│   ├── useCache.ts       # Client-side caching
│   ├── useDebounce.ts    # Debounce hook
│   └── (useKeyboard.ts)
│
└── utils/
    ├── pdf.ts            # Client-side PDF generation
    ├── rx.ts             # Prescription formatting
    └── date.ts           # Date formatting
```

---

## 3. Database Architecture

### 3.1 Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Customer   │────<│    Visit      │────<│  Prescription     │
│              │     │              │     │                    │
│ customerId   │     │ customerId   │     │ customerId        │
│ name         │     │ visitDate    │     │ visitId           │
│ mobile       │     │ visitType    │     │ rightEye.dv/nv/pc │
│ totalVisits  │     │ doctorName   │     │ leftEye.dv/nv/pc  │
│ totalSpent   │     │ shop         │     │ pd                │
│ pendingAmount│     └──────────────┘     └──────────────────┘
│ tags[]       │            │
└──────┬───────┘            │
       │                    │
       │         ┌──────────┘
       │         │
       ├────────<│    Order
       │         │
       │         │ customerId
       │         │ visitId
       │         │ frame/lens/coating details
       │         │ status (state machine)
       │         │ classification
       │         │
       │         ├──────────>┌──────────────┐
       │         │           │   Delivery    │
       │         │           │              │
       │         │           │ customerId   │
       │         │           │ orderId      │
       │         │           │ status       │
       │         │           └──────────────┘
       │         │
       │         │
       ├────────<│    Bill
       │         │
       │         │ customerId
       │         │ visitId
       │         │ items[]
       │         │ subtotal/discount/tax
       │         │ totalAmount
       │         │ advancePaid
       │         │ pendingAmount
       │         │
       │         └──────────>┌──────────────┐
       │                     │   Payment     │
       │                     │              │
       ├─────────────────────│ customerId   │
                             │ billId       │
                             │ amount       │
                             │ paymentMode  │
                             └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Branch     │  │    User      │  │  Inventory   │
│              │  │              │  │              │
│ name         │  │ username     │  │ sku          │
│ code         │  │ passwordHash │  │ category     │
│ dbName       │  │ role         │  │ brand        │
│ isActive     │  │ branches[]   │  │ quantity     │
│ settings     │  └──────────────┘  │ location     │
└──────────────┘                    │ prices       │
                                    └──────────────┘
```

### 3.2 Branch Database Isolation

```
┌─────────────────────────────────────────────────────────┐
│                   Main Database                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │  users   │  │ branches │  │  baileys_auth      │    │
│  │ (global) │  │ (global) │  │  (legacy WA auth)  │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
│                                                          │
│  Branch 1 ──────────> Branch 2 ──────────> Branch N     │
│  dbName:              dbName:              dbName:       │
│  kmj_govindpuri       kmj_{code2}          kmj_{codeN}  │
└─────────────────────────────────────────────────────────┘

Each Branch Database Contains:
  customers, visits, prescriptions, orders, bills,
  payments, inventory, deliveries, settings, todos,
  baileys_auth_{branchId}
```

### 3.3 MongoDB Indexes

| Collection | Index | Type | Purpose |
|------------|-------|------|---------|
| Customer | `{ totalSpent: -1 }` | Descending | Top customers by spend |
| Customer | `{ createdAt: -1 }` | Descending | Recent customers |
| Visit | `{ customerId: 1 }` | Ascending | Customer's visits |
| Visit | `{ visitDate: -1 }` | Descending | Recent visits |
| Prescription | `{ customerId: 1, createdAt: -1 }` | Compound | Customer's prescriptions |
| Prescription | `{ visitId: 1 }` | Ascending | Visit's prescription |
| Order | `{ customerId: 1, createdAt: -1 }` | Compound | Customer's orders |
| Order | `{ status: 1, createdAt: -1 }` | Compound | Filter by status |
| Order | `{ classification: 1, createdAt: -1 }` | Compound | Demand list queries |
| Order | `{ createdAt: -1 }` | Descending | Recent orders |
| Bill | `{ customerId: 1, createdAt: -1 }` | Compound | Customer's bills |
| Bill | `{ pendingAmount: 1 }` | Ascending | Pending amount queries |
| Bill | `{ createdAt: -1 }` | Descending | Recent bills |
| Bill | `{ billNumber: 1 }` | Unique | Bill number lookup |
| Payment | `{ customerId: 1, paymentDate: -1 }` | Compound | Customer's payments |
| Payment | `{ paymentDate: -1 }` | Descending | Recent payments |
| Payment | `{ billId: 1 }` | Ascending | Bill's payments |
| Inventory | `{ sku: 1 }` | Unique | SKU lookup |
| Delivery | `{ status: 1, expectedDeliveryDate: 1 }` | Compound | Delivery queue |
| Delivery | `{ orderId: 1 }` | Ascending | Order's delivery |
| Customer | `{ customerId: 1 }` | Ascending | Display ID lookup |
| Customer | `{ mobile: 1 }` | Ascending | Phone lookup |

---

## 4. API Endpoint Mapping

### 4.1 Complete API Route Table

| Method | Endpoint | Auth | Branch | Cache | Audit | Handler |
|--------|----------|------|--------|-------|-------|---------|
| **Auth** |
| POST | `/api/auth/register` | ✅ | ❌ | ❌ | ❌ | authController.register |
| POST | `/api/auth/login` | ❌ | ❌ | ❌ | ❌ | authController.login |
| POST | `/api/auth/staff-login` | ❌ | ❌ | ❌ | ❌ | authController.staffLogin |
| POST | `/api/auth/warehouse-login` | ❌ | ❌ | ❌ | ❌ | authController.warehouseLogin |
| POST | `/api/auth/warehouse-register` | ✅ | ❌ | ❌ | ❌ | authController.warehouseRegister |
| POST | `/api/auth/refresh` | ❌ | ❌ | ❌ | ❌ | authController.refresh |
| GET | `/api/auth/me` | ✅ | ❌ | ❌ | ❌ | authController.me |
| PUT | `/api/auth/me` | ✅ | ❌ | ❌ | ❌ | authController.updateMe |
| GET | `/api/auth/users` | ✅ | ❌ | ❌ | ❌ | authController.listUsers |
| GET | `/api/auth/warehouse-users` | ✅ | ❌ | ❌ | ❌ | authController.listWarehouseUsers |
| PUT | `/api/auth/users/:id` | ✅ | ❌ | ❌ | ❌ | authController.updateUser |
| DELETE | `/api/auth/users/:id` | ✅ | ❌ | ❌ | ❌ | authController.deleteUser |
| **Branches** |
| GET | `/api/branches/active` | ❌ | ❌ | ❌ | ❌ | Branch.find({isActive:true}) |
| GET | `/api/branches` | ✅ | ❌ | ❌ | ❌ | Branch.find() |
| GET | `/api/branches/:id` | ✅ | ❌ | ❌ | ❌ | Branch.findById() |
| POST | `/api/branches` | ✅ | ❌ | ❌ | ❌ | Branch.create() |
| PUT | `/api/branches/:id` | ✅ | ❌ | ❌ | ❌ | Branch.findByIdAndUpdate() |
| DELETE | `/api/branches/:id` | ✅ | ❌ | ❌ | ❌ | Branch soft-delete |
| **Customers** |
| GET | `/api/customers` | ✅ | ✅ | 60s | ❌ | customerController.getAll |
| POST | `/api/customers` | ✅ | ✅ | invalidate | ❌ | customerController.create |
| GET | `/api/customers/summary/:id` | ✅ | ✅ | 30s | ❌ | customerController.getSummary |
| GET | `/api/customers/:id` | ✅ | ✅ | ❌ | ❌ | customerController.getById |
| PUT | `/api/customers/:id` | ✅ | ✅ | invalidate | ❌ | customerController.update |
| DELETE | `/api/customers/:id` | ✅ | ✅ | invalidate | ❌ | customerController.remove |
| **Visits** |
| GET | `/api/visits` | ✅ | ✅ | 30s | ❌ | Visit.find() |
| POST | `/api/visits` | ✅ | ✅ | invalidate | ❌ | Visit.create() |
| GET | `/api/visits/:id` | ✅ | ✅ | ❌ | ❌ | Visit.findById() |
| PUT | `/api/visits/:id` | ✅ | ✅ | invalidate | ❌ | Visit.findByIdAndUpdate() |
| DELETE | `/api/visits/:id` | ✅ | ✅ | invalidate | ❌ | Visit.findByIdAndDelete() |
| **Prescriptions** |
| GET | `/api/prescriptions` | ✅ | ✅ | 30s | ❌ | Prescription.find() |
| POST | `/api/prescriptions` | ✅ | ✅ | ❌ | ❌ | Prescription.create() |
| GET | `/api/prescriptions/:id` | ✅ | ✅ | ❌ | ❌ | Prescription.findById() |
| PUT | `/api/prescriptions/:id` | ✅ | ✅ | ❌ | ❌ | Prescription.findByIdAndUpdate() |
| DELETE | `/api/prescriptions/:id` | ✅ | ✅ | ❌ | ❌ | Prescription.findByIdAndDelete() |
| **Orders** |
| GET | `/api/orders` | ✅ | ✅ | 30s | ❌ | Order.find() + Bill enrichment |
| POST | `/api/orders` | ✅ | ✅ | invalidate | ✅ | Order.create() |
| GET | `/api/orders/:id` | ✅ | ✅ | ❌ | ❌ | Order.findById() |
| PUT | `/api/orders/:id` | ✅ | ✅ | invalidate | ✅ | Order.findByIdAndUpdate() |
| PATCH | `/api/orders/:id/status` | ✅ | ✅ | invalidate | ❌ | State machine + WhatsApp |
| PATCH | `/api/orders/:id/classify` | ✅ | ✅ | invalidate | ❌ | Classification update |
| PATCH | `/api/orders/:id/classify-eye` | ✅ | ✅ | invalidate | ❌ | Per-eye classification |
| PATCH | `/api/orders/:id/review` | ✅ | ✅ | invalidate | ❌ | Review toggle |
| DELETE | `/api/orders/:id` | ✅ | ✅ | invalidate | ✅ | Order.findByIdAndDelete() |
| POST | `/api/orders/demand-send` | ✅ | ✅ | ❌ | ❌ | Demand PDF + WhatsApp |
| **Bills** |
| GET | `/api/bills` | ✅ | ✅ | 30s | ❌ | Bill.find() |
| POST | `/api/bills` | ✅ | ✅ | invalidate | ✅ | Bill.create() + WhatsApp PDF |
| GET | `/api/bills/:id` | ✅ | ✅ | ❌ | ❌ | Bill.findById() |
| PUT | `/api/bills/:id` | ✅ | ✅ | invalidate | ✅ | Bill update + delta adjust |
| DELETE | `/api/bills/:id` | ✅ | ✅ | invalidate | ✅ | Bill.delete() + reverse |
| **Payments** |
| GET | `/api/payments` | ✅ | ✅ | 30s | ❌ | Payment.find() |
| POST | `/api/payments` | ✅ | ✅ | invalidate | ✅ | Payment.create() + bill update |
| PUT | `/api/payments/:id` | ✅ | ✅ | invalidate | ✅ | Payment update + delta adjust |
| DELETE | `/api/payments/:id` | ✅ | ✅ | invalidate | ❌ | Payment.delete() + reverse |
| **Inventory** |
| GET | `/api/inventory/stats` | ✅ | ✅ | ❌ | ❌ | Inventory aggregations |
| GET | `/api/inventory` | ✅ | ✅ | 60s | ❌ | Inventory.find() |
| GET | `/api/inventory/qr/:code` | ✅ | ✅ | ❌ | ❌ | Inventory.findOne({sku}) |
| GET | `/api/inventory/:id/qr-image` | ✅ | ✅ | ❌ | ❌ | QRCode.toBuffer() |
| GET | `/api/inventory/:id` | ✅ | ✅ | ❌ | ❌ | Inventory.findById() |
| POST | `/api/inventory` | ✅ | ✅ | invalidate | ✅ | Inventory.create() |
| PUT | `/api/inventory/:id/stock` | ✅ | ✅ | invalidate | ✅ | $inc quantity |
| PUT | `/api/inventory/:id` | ✅ | ✅ | invalidate | ✅ | Inventory.findByIdAndUpdate() |
| DELETE | `/api/inventory/:id` | ✅ | ✅ | invalidate | ✅ | Inventory.findByIdAndDelete() |
| **Delivery** |
| GET | `/api/delivery` | ✅ | ✅ | 30s | ❌ | Delivery.find() |
| GET | `/api/delivery/:id` | ✅ | ✅ | ❌ | ❌ | Delivery.findById() |
| **Workspace** |
| POST | `/api/workspace/transaction` | ✅ | ✅ | invalidate all | ❌ | Atomic multi-entity creation |
| **Dashboard** |
| GET | `/api/dashboard/stats` | ✅ | ✅ | 30s | ❌ | 20+ parallel aggregations |
| **Reports** |
| GET | `/api/reports/revenue` | ✅ | ✅ | 60s | ❌ | Bill + Payment aggregates |
| GET | `/api/reports/monthly` | ✅ | ✅ | 120s | ❌ | Monthly aggregates |
| GET | `/api/reports/customers` | ✅ | ✅ | 120s | ❌ | Customer analytics |
| GET | `/api/reports/inventory` | ✅ | ✅ | 60s | ❌ | Inventory analytics |
| GET | `/api/reports/deliveries` | ✅ | ✅ | 30s | ❌ | Delivery analytics |
| **Settings** |
| GET | `/api/settings` | ✅ | ✅ | ❌ | ❌ | Settings.findOne() |
| PUT | `/api/settings` | ✅ | ✅ | ❌ | ❌ | Settings.findOneAndUpdate() |
| **WhatsApp** |
| GET | `/api/whatsapp/status` | ✅ | ✅ | ❌ | ❌ | WhatsApp status |
| GET | `/api/whatsapp/qr` | ✅ | ✅ | ❌ | ❌ | QR code |
| GET | `/api/whatsapp/queue` | ✅ | ✅ | ❌ | ❌ | Queue length |
| POST | `/api/whatsapp/send` | ✅ | ✅ | ❌ | ❌ | Send text |
| POST | `/api/whatsapp/send-media` | ✅ | ✅ | ❌ | ❌ | Send media |
| POST | `/api/whatsapp/disconnect` | ✅ | ✅ | ❌ | ❌ | Disconnect |
| POST | `/api/whatsapp/pair` | ✅ | ✅ | ❌ | ❌ | Pairing code |
| POST | `/api/whatsapp/init` | ✅ | ✅ | ❌ | ❌ | Reinitialize |
| POST | `/api/whatsapp/broadcast` | ✅ | ✅ | ❌ | ❌ | Broadcast |
| POST | `/api/whatsapp/broadcast/abort` | ✅ | ✅ | ❌ | ❌ | Abort broadcast |
| **Cache Admin** |
| GET | `/api/cache/keys` | ❌ | ❌ | ❌ | ❌ | List cache keys |
| DELETE | `/api/cache/flush` | ❌ | ❌ | ❌ | ❌ | Flush all cache |
| DELETE | `/api/cache/pattern` | ❌ | ❌ | ❌ | ❌ | Pattern-based flush |
| **Recalculate** |
| POST | `/api/recalculate/customers` | ❌ | ❌ | ❌ | ❌ | Recalculate denormalized fields |

---

## 5. Middleware Chain

### 5.1 Request Processing Pipeline

```
Incoming Request
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Helmet (Security Headers)            │
│    - Content-Security-Policy: disabled   │
│    - X-Frame-Options: DENY              │
│    - X-Content-Type-Options: nosniff     │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 2. CORS                                   │
│    - Origin whitelist                     │
│    - Credentials: true                    │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 3. Compression (gzip level 6)            │
│    - Threshold: 1024 bytes               │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 4. JSON Parser (25mb limit)              │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 5. Morgan (HTTP logging)                 │
│    - Format: "dev"                        │
│    - Disabled in test                     │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 6. Global Audit                          │
│    - Logs: time, method, path, user, ip  │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 7. Rate Limiter                          │
│    - 200 requests per minute per IP      │
│    - Standard headers                    │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 8. Route Handler                         │
│    │                                     │
│    ├─ Branch Scope Middleware            │
│    │  (X-Branch-ID header)              │
│    │  → loads branch models             │
│    │  → AsyncLocalStorage context       │
│    │                                     │
│    ├─ Auth Middleware                    │
│    │  (Bearer token verification)        │
│    │  → req.user = JwtPayload           │
│    │                                     │
│    ├─ Cache Middleware (GET only)        │
│    │  → check Redis cache               │
│    │  → HIT: return cached response     │
│    │  → MISS: intercept res.json()      │
│    │                                     │
│    ├─ Audit Middleware (mutations)       │
│    │  → logs method, path, user, ip     │
│    │                                     │
│    └─ Route Handler                     │
│       → Zod validation                  │
│       → Business logic                  │
│       → Database operations             │
│       → Cache invalidation              │
│       → Response                        │
│                                         │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ 9. Error Handler (catch-all)            │
│    - AppError → status + message        │
│    - ValidationError → 400              │
│    - CastError → 400 "Invalid ID"       │
│    - Duplicate key (11000) → 409        │
│    - Unknown → 500 "Internal Error"     │
└─────────────────────────────────────────┘
```

### 5.2 Branch Scope Flow

```
Request with X-Branch-ID header
    │
    ▼
branchScope middleware
    │
    ├── No header? → next() (use default/global models)
    │
    └── Has header?
         │
         ▼
    Branch.findById(branchId)
         │
         ├── Not found or inactive → next()
         │
         └── Found & active
              │
              ▼
         getBranchModels(branch.dbName)
              │
              ▼
         mongoose.connection.useDb(dbName)
              │
              ▼
         Register models on connection
              │
              ▼
         Store in branchModelCache Map
              │
              ▼
         ctx.run(requestContext, () => next())
              │
              ▼
         withBranch Proxy intercepts model calls
              │
              ▼
         Route handler uses proxied models
         (transparently uses branch database)
```

---

## 6. Component Interaction Diagrams

### 6.1 Order Status Update Flow

```
Client (PATCH /api/orders/:id/status)
    │
    ▼
Express Router
    │
    ├── branchScope → load branch models
    ├── authenticate → verify JWT
    │
    ▼
Order Route Handler
    │
    ├── Validate request (Zod)
    ├── Validate status transition (VALID_TRANSITIONS)
    ├── Calculate partial advancement (forwardedCount)
    │
    ├── Update order.status / forwardedCount
    ├── Save order
    │
    ├── Auto-update delivery status (if full advancement)
    │   └── Delivery.findOne({orderId}) → update status
    │
    ├── Auto-send WhatsApp (if Ready + full advancement)
    │   ├── Customer.findById → get name/mobile
    │   ├── Settings.findOne → get shopName
    │   └── wa.sendMessage → WhatsApp notification
    │
    ├── Auto-send WhatsApp (if Delivered + full advancement)
    │   └── (similar to above)
    │
    ├── Auto-create payment (if Delivered + collectPayment)
    │   ├── Find bill by visitId or customerId
    │   ├── Payment.create → new payment record
    │   ├── Bill update → advancePaid, pendingAmount
    │   └── Customer update → pendingAmount
    │
    ├── Invalidate caches (/api/orders, /api/dashboard)
    │
    └── Return response with order + partial + delivery + payment
```

### 6.2 Bill Creation Flow

```
Client (POST /api/bills)
    │
    ▼
Express Router → branchScope → authenticate → audit
    │
    ▼
Bill Route Handler
    │
    ├── Zod validation
    ├── Generate billNumber: BILL-{timestamp}
    ├── Calculate subtotal from items
    ├── Calculate totalAmount = subtotal - discount + tax
    ├── Calculate pendingAmount = total - advancePaid
    │
    ├── Bill.create()
    │
    ├── Customer.findByIdAndUpdate → totalSpent += total, pendingAmount += pending
    │
    ├── Async WhatsApp notification (fire-and-forget)
    │   ├── Find customer by ID
    │   ├── Settings.findOne → shop details
    │   ├── generateBillPdf() → PDFKit buffer
    │   ├── wa.sendMedia → WhatsApp PDF
    │   └── catch {} → silently ignore failures
    │
    ├── Invalidate caches (/api/bills, /api/dashboard)
    │
    └── Return response with bill data
```

### 6.3 Workspace Transaction Flow

```
Client (POST /api/workspace/transaction)
    │
    ▼
Express Router → branchScope → authenticate
    │
    ▼
Workspace Route Handler
    │
    ├── Zod validation
    │
    ├── Step 1: Customer
    │   ├── If customerId → Customer.findById
    │   ├── If customer._id → Customer.findById
    │   ├── If customer.mobile → Customer.findOne({mobile})
    │   └── If none found → Customer.create (new customer)
    │
    ├── Step 2: Visit (if provided)
    │   ├── Visit.create (linked to customer)
    │   └── Customer totalVisits += 1
    │
    ├── Step 3: Prescription (if provided + visit)
    │   └── Prescription.create (linked to customer + visit)
    │
    ├── Step 4: Order (if provided)
    │   └── Order.create (linked to customer + visit)
    │
    ├── Step 5: Bill (if provided)
    │   ├── Bill.create (with billNumber)
    │   └── Customer totalSpent += totalAmount, pendingAmount += billPending
    │
    ├── Step 6: Payment (if provided + amount > 0)
    │   └── Payment.create (linked to customer + bill)
    │
    ├── Step 7: Delivery (if provided + order)
    │   └── Delivery.create (linked to customer + order)
    │
    ├── Invalidate ALL caches
    │
    └── Return response with all created entities
```

### 6.4 Dashboard Aggregation Flow

```
Client (GET /api/dashboard/stats)
    │
    ▼
Express Router → branchScope → authenticate → cache(30s)
    │
    ▼
Dashboard Route Handler
    │
    ├── 20+ parallel MongoDB queries via Promise.all([
    │   ├── Customer.countDocuments()
    │   ├── Order.countDocuments()
    │   ├── Bill.countDocuments()
    │   ├── Payment.countDocuments()
    │   ├── Inventory.countDocuments()
    │   ├── Delivery.countDocuments()
    │   ├── Visit.countDocuments()
    │   ├── Bill.aggregate (todaySales)
    │   ├── Payment.aggregate (todayCollection)
    │   ├── Bill.aggregate (weekSales)
    │   ├── Bill.aggregate (monthSales)
    │   ├── Delivery.countDocuments (ready)
    │   ├── Customer.countDocuments (new today)
    │   ├── Inventory.countDocuments (low stock)
    │   ├── Payment.aggregate (pending)
    │   ├── Customer.find (recent 5)
    │   ├── Order.find (recent 5)
    │   ├── Delivery.find (today + pending)
    │   ├── Bill.find (pending, top 5)
    │   ├── async IIFE (incomplete orders + stock cross-ref)
    │   ├── Order.countDocuments (today/week/month)
    │   ├── Bill.countDocuments (today/week/month)
    │   ├── Bill.aggregate (30-day daily sales)
    │   ├── Payment.aggregate (mode split)
    │   ├── Order.aggregate (status counts)
    │   ├── Bill.aggregate (same day last week)
    │   └── Order.find (delivered today)
    │   ])
    │
    ├── Calculate salesTrend (% vs last week)
    │
    ├── Return aggregated response
    │   └── ~25 data points in single response
    │
    └── Cache response for 30 seconds
```

---

## 7. Caching Architecture

### 7.1 Cache Strategy

```
┌─────────────────────────────────────────────────────┐
│                   Cache Architecture                 │
│                                                      │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐    │
│  │  Client   │────>│  Server  │────>│  Redis   │    │
│  │ (React)   │     │ (Express)│     │ (Cache)  │    │
│  └──────────┘     └──────────┘     └──────────┘    │
│                                                      │
│  Key Format: {branchId}:{requestUrl}                │
│  Value: { body: responseData, status: statusCode }  │
│  TTL: 30-120 seconds depending on route             │
│                                                      │
│  Invalidation:                                       │
│  - Pattern: *:{routePattern}*                       │
│  - Auto-invalidate /api/dashboard on any mutation   │
│  - Branch-aware: invalidating /api/customers       │
│    invalidates ALL branch variants                  │
└─────────────────────────────────────────────────────┘
```

### 7.2 Cache Invalidation Chain

```
Mutation occurs (POST/PUT/DELETE)
    │
    ├── Invalidate specific route cache
    │   └── cacheDel("*:/api/{route}*")
    │
    ├── Auto-invalidate dashboard
    │   └── cacheDel("*:/api/dashboard*")
    │
    └── Some routes invalidate multiple:
        - Bills: /api/bills + /api/dashboard
        - Payments: /api/payments + /api/bills + /api/dashboard
        - Workspace: /api/customers + /api/visits + /api/prescriptions
                     + /api/orders + /api/bills + /api/dashboard
```

---

## 8. WhatsApp Architecture

### 8.1 Per-Branch WhatsApp Instances

```
WhatsAppManager (singleton, server-wide)
    │
    ├── defaultInstance: WhatsAppService
    │     authCollection: "baileys_auth"
    │     (legacy, used when no branch)
    │
    └── instances Map:
          │
          ├── "branch_id_1": WhatsAppService
          │     ├── authCollection: "baileys_auth_branch_id_1"
          │     ├── sock: WASocket (Baileys)
          │     ├── messageQueue: QueueItem[]
          │     ├── _ready: boolean
          │     ├── _qr: string | null
          │     └── _pairingCode: string | null
          │
          └── "branch_id_2": WhatsAppService
                └── (same structure)
```

### 8.2 WhatsApp Lifecycle

```
Server Start
    │
    ├── initBranchWhatsApps()
    │   ├── Find all active branches
    │   ├── For each branch: getInstance(branchId).init()
    │   └── Each init creates independent Baileys connection
    │
    ▼
Connection States:
    │
    ├── initializing → generating QR
    │   └── QR displayed in WhatsApp settings page
    │
    ├── QR scanned → credentials saved to MongoDB
    │   └── connection: "open" → ready
    │
    ├── Ready → messages sent immediately
    │   └── Queue drained on reconnect
    │
    ├── Disconnected → auto-reconnect (exponential backoff)
    │   ├── 5s → 10s → 15s → 20s → 25s
    │   └── Max 5 attempts
    │
    └── Auth failed → clear session → need new QR scan
```

---

## 9. Multi-Tenant Architecture

### 9.1 Tenant Isolation Model

```
┌─────────────────────────────────────────────────────────┐
│                    Shared Infrastructure                   │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Users     │  │  Branches   │  │  WhatsApp    │     │
│  │  (global)   │  │  (global)   │  │  Manager     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Branch-Scoped Data                      ││
│  │                                                      ││
│  │  Branch A ────────> MongoDB: kmj_branchA            ││
│  │  customers, visits, orders, bills, ...              ││
│  │                                                      ││
│  │  Branch B ────────> MongoDB: kmj_branchB            ││
│  │  customers, visits, orders, bills, ...              ││
│  │                                                      ││
│  │  Branch C ────────> MongoDB: kmj_branchC            ││
│  │  customers, visits, orders, bills, ...              ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Isolation Mechanism:                                    │
│  - AsyncLocalStorage carries branch context per request  │
│  - withBranch Proxy transparently routes model calls     │
│  - Connection caching avoids repeated useDb() calls      │
└─────────────────────────────────────────────────────────┘
```

### 9.2 User-Branch Relationship

```
┌────────────────────────────────────────┐
│              User                       │
│  role: "owner"                         │
│  branches: [branchA, branchB, branchC] │  ← Owner: all branches
│                                        │
│  role: "staff"                         │
│  branches: [branchA]                   │  ← Staff: 1 branch
│                                        │
│  role: "warehouse"                     │
│  branches: []                          │  ← Warehouse: no branch
└────────────────────────────────────────┘
```

---

## 10. Architectural Decisions

### 10.1 Decision Log

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| AD-01 | MongoDB over PostgreSQL | Document model fits optical shop data (flexible prescription schemas); Mongoose ODM simplifies Node.js integration | No ACID transactions across documents |
| AD-02 | Branch-per-database isolation | Complete data isolation; simple query routing; no row-level security needed | Schema changes must be applied to all branch DBs |
| AD-03 | AsyncLocalStorage for branch context | Transparent to route handlers; no need to pass branch models through every function | Requires careful async flow management |
| AD-04 | withBranch Proxy pattern | Zero-cost abstraction for branch switching; existing route code works unchanged | Proxy overhead (minimal in practice) |
| AD-05 | Denormalized counters (totalSpent, pendingAmount) | Fast dashboard queries without joins; O(1) reads | Requires careful counter maintenance on mutations |
| AD-06 | Redis caching with graceful degradation | System works without Redis; automatic cache on GET | Cache consistency requires manual invalidation |
| AD-07 | Baileys for WhatsApp | Free, no official API needed; supports media sending | Reverse-engineered protocol; can break with WhatsApp updates |
| AD-08 | PDFKit for server-side PDF | Full control over PDF layout; consistent output | Server CPU cost for PDF generation |
| AD-09 | Workspace transaction (non-ACID) | Simpler than MongoDB transactions; covers 99% of cases | Partial failure leaves orphaned entities |
| AD-10 | Zod for validation | TypeScript-first schema validation; type inference | Learning curve for team |
| AD-11 | JWT with refresh tokens | Stateless auth; works with multi-branch | Token revocation requires client-side logout |
| AD-12 | Fire-and-forget WhatsApp | Bill/Order operations never blocked by WhatsApp | Lost notifications (no retry beyond queue) |
| AD-13 | Vite for frontend builds | Fast HMR; modern tooling; React support | Less mature than webpack ecosystem |
| AD-14 | Tailwind CSS | Rapid UI development; consistent design system | CSS file size (mitigated by purge) |
| AD-15 | Lazy loading all pages | Smaller initial bundle; faster first paint | Slight delay on first navigation |

### 10.2 Anti-Patterns Avoided

| Anti-Pattern | How Avoided |
|--------------|-------------|
| N+1 queries | Dashboard uses parallel `Promise.all` with 20+ queries |
| Silent failures | All external calls (WhatsApp, cache) wrapped in try/catch |
| Global state pollution | AsyncLocalStorage for request-scoped branch context |
| Duplicate code | Shared models, middleware, and utilities |
| Missing validation | Zod schemas on all creation/update endpoints |
| Hard-coded secrets | All config via environment variables |
| Monolithic route handlers | Controllers extracted for auth, customers |

---

## 11. Security Architecture

### 11.1 Security Layers

```
┌─────────────────────────────────────────┐
│ Layer 1: Transport                       │
│ - HTTPS (production via Render.com)     │
│ - CORS whitelist                        │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 2: Headers                         │
│ - Helmet security headers               │
│ - CSP disabled for SPA                  │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 3: Rate Limiting                   │
│ - 200 requests/minute per IP            │
│ - Standard headers                      │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 4: Authentication                  │
│ - JWT Bearer token                      │
│ - Access: 24h, Refresh: 7d              │
│ - bcrypt password hashing (10 rounds)   │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 5: Authorization                   │
│ - Role-based (owner, staff, warehouse)  │
│ - requireRole() middleware               │
│ - Frontend RoleGuard component          │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 6: Input Validation                │
│ - Zod schemas on all inputs             │
│ - Whitelisted update fields             │
│ - Regex escape for search               │
└─────────────┬───────────────────────────┘
              │
    ▼
┌─────────────────────────────────────────┐
│ Layer 7: Data Isolation                  │
│ - Branch-scoped databases               │
│ - AsyncLocalStorage context             │
│ - withBranch proxy                      │
└─────────────────────────────────────────┘
```

---

## 12. Deployment Architecture

### 12.1 Production Deployment

```
┌─────────────────────────────────────────┐
│            Render.com                    │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Web Service (kmjoptical.onrender│   │
│  │  │                                │   │
│  │  ├── Node.js runtime              │   │
│  │  ├── Express serves:              │   │
│  │  │   ├── /api/* (REST API)        │   │
│  │  │   ├── /* (client SPA)          │   │
│  │  │   └── /warehouse/* (warehouse) │   │
│  │  └── Port from $PORT env          │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  MongoDB Atlas (external)        │   │
│  │  Connection: $MONGO_URI           │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Redis (external, optional)      │   │
│  │  Connection: $REDIS_URL           │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  WhatsApp (Baileys)              │   │
│  │  Runs in-process with server     │   │
│  │  Auth state in MongoDB           │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 12.2 Build Pipeline

```
Development:
  npm run dev → concurrently starts 3 Vite dev servers + ts-node-dev

Production Build:
  npm run build
    ├── client: vite build → client/dist/
    ├── server: tsc → server/dist/
    └── warehouse: vite build → warehouse/dist/

Production Run:
  node server/dist/index.js
    ├── Serves client/dist/ as static files
    ├── Serves warehouse/dist/ at /warehouse
    └── API at /api/*
```

### 12.3 Static File Serving

```
Express Static Middleware:
  ├── client/dist/ → served at root (/)
  │   ├── maxAge: 1 year, immutable
  │   └── HTML: no-cache
  │
  ├── warehouse/dist/ → served at /warehouse
  │   ├── maxAge: 1 year, immutable
  │   └── HTML: no-cache
  │
  └── Fallback: /* → index.html (SPA routing)
      └── /warehouse* → warehouse/index.html
```

---

## AI Instructions for Using This Knowledge

When making architectural changes:

1. **Branch isolation is sacred**: Never add a global model without explicit reason. All business data must be branch-scoped.

2. **Denormalized fields need dual writes**: Any mutation to Customer.totalVisits/totalSpent/pendingAmount must be reflected in the actual mutation code.

3. **Cache invalidation is part of the feature**: When adding new API endpoints, always add cache invalidation on mutations.

4. **Middleware order matters**: auth → branchScope → cache → audit is the standard order. Reordering can cause issues.

5. **WhatsApp is fire-and-forget**: Never await WhatsApp calls in critical paths. Wrap in async IIFE with try/catch.

6. **Error handler is last**: The errorHandler middleware must be registered after all routes.

7. **Rate limiting is global**: 200 req/min applies to all routes. Consider per-route overrides for high-traffic endpoints.

8. **No MongoDB transactions**: The system does not use MongoDB transactions. Workspace transaction is best-effort sequential.

9. **Branch model caching**: `branchModelCache` in `db.ts` caches connections. Changing branch database names requires `clearBranchCache()`.

10. **Static file serving**: Server serves both client and warehouse SPAs. Changes to build output paths require updating `app.ts`.
