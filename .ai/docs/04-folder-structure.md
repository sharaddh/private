# 04 - Folder Structure

## Purpose

This document defines the complete folder structure of the KMJ Optical ERP project. Every file and directory has a specific purpose. Understanding this structure is essential for navigating and modifying the codebase.

## Root Structure

```
D:\123\
├── .ai/                    # Engineering knowledge base
├── .git/                   # Git repository
├── .gitattributes          # Git attributes
├── .gitignore              # Git ignore rules
├── .nvmrc                  # Node version manager config
├── client/                 # Main ERP React client
├── server/                 # Backend Express API
├── warehouse/              # Warehouse React app
├── package.json            # Root package.json (orchestration)
├── package-lock.json       # Root lock file
├── render.yaml             # Render.com deployment config
├── README.md               # Project documentation
└── *.patch                 # Patch files (temporary)
```

## Client Structure (`client/`)

```
client/
├── .env                    # Environment variables
├── .env.example            # Example environment variables
├── .env.local              # Local environment overrides
├── .env.production         # Production environment variables
├── .gitignore              # Git ignore rules
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── postcss.config.cjs      # PostCSS configuration
├── tailwind.config.cjs     # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── dist/                   # Production build output
├── node_modules/           # Dependencies
├── public/                 # Static assets
│   └── favicon.ico         # Favicon
└── src/
    ├── main.tsx            # Application entry point
    ├── App.tsx             # Root component with routing
    ├── App.css             # Global styles
    ├── index.css           # Tailwind imports
    ├── api.ts              # API client and endpoints
    ├── assets/             # Static assets (images, etc.)
    ├── components/         # Reusable UI components
    │   ├── CameraScanner.tsx
    │   ├── DashboardCharts.tsx
    │   ├── DateRangePicker.tsx
    │   ├── Form.tsx
    │   ├── Layout.tsx
    │   ├── Modal.tsx
    │   ├── PageSkeleton.tsx
    │   ├── RoleGuard.tsx
    │   ├── Skeleton.tsx
    │   ├── StatCard.tsx
    │   ├── Table.tsx
    │   ├── Toast.tsx
    │   ├── errors/         # Error boundary components
    │   └── NewvistePage/   # New visit page components
    ├── context/            # React Context providers
    │   └── (AppProviders, etc.)
    ├── hooks/              # Custom React hooks
    │   └── (useCache, etc.)
    ├── pages/              # Page components
    │   ├── Dashboard.tsx
    │   ├── Customers.tsx
    │   ├── CustomerDetail.tsx
    │   ├── CustomerNewVisit.tsx
    │   ├── Orders.tsx
    │   ├── Bills.tsx
    │   ├── Payments.tsx
    │   ├── InventoryPage.tsx
    │   ├── Delivery.tsx
    │   ├── Pickup.tsx
    │   ├── Reports.tsx
    │   ├── Settings.tsx
    │   ├── WhatsApp.tsx
    │   ├── Workspace.tsx
    │   ├── Login.tsx
    │   ├── Register.tsx
    │   ├── StaffLogin.tsx
    │   ├── ItemScan.tsx
    │   ├── Announcement.tsx
    │   └── settings/       # Settings sub-pages
    └── utils/              # Utility functions
        └── (helpers, etc.)
```

### Client File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `Dashboard.tsx`, `Layout.tsx` |
| Pages | PascalCase | `Customers.tsx`, `Orders.tsx` |
| Hooks | camelCase with `use` prefix | `useCache.ts` |
| Utils | camelCase | `helpers.ts` |
| Context | PascalCase with `Context` suffix | `AuthContext.tsx` |
| Styles | camelCase | `index.css` |
| Config | camelCase | `vite.config.ts` |

### Client Component Organization

**Shared Components** (`components/`):
- Used across multiple pages
- Generic, reusable UI elements
- Examples: `Modal.tsx`, `Table.tsx`, `Toast.tsx`

**Page Components** (`pages/`):
- Specific to a single page
- Compose shared components
- Examples: `Dashboard.tsx`, `Customers.tsx`

**Context Providers** (`context/`):
- Provide global state
- Used for authentication, theming, translations
- Examples: `AppProviders.tsx`

**Custom Hooks** (`hooks/`):
- Extract reusable logic
- Used for data fetching, caching, etc.
- Examples: `useCache.ts`

**Utilities** (`utils/`):
- Pure functions with no side effects
- Used for formatting, calculations, etc.
- Examples: `helpers.ts`

## Server Structure (`server/`)

```
server/
├── .env                    # Environment variables
├── .env.example            # Example environment variables
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── dist/                   # Compiled JavaScript output
├── node_modules/           # Dependencies
├── docs/                   # API documentation (OpenAPI)
│   └── openapi.yaml        # OpenAPI specification
├── .wwebjs_auth/           # WhatsApp auth state
├── .wwebjs_cache/          # WhatsApp cache
├── src/
│   ├── index.ts            # Server entry point
│   ├── app.ts              # Express app configuration
│   ├── config.ts           # Configuration constants
│   ├── controllers/        # Business logic controllers
│   │   ├── authController.ts
│   │   ├── customerController.ts
│   │   └── todoController.ts
│   ├── middleware/          # Express middleware
│   │   ├── asyncHandler.ts
│   │   ├── audit.ts
│   │   ├── auth.ts
│   │   ├── branch.ts
│   │   ├── cache.ts
│   │   └── errorHandler.ts
│   ├── migrations/         # Database migrations
│   │   └── migrate-legacy.ts
│   ├── models/             # Mongoose models
│   │   ├── bill.ts
│   │   ├── branch.ts
│   │   ├── customer.ts
│   │   ├── db.ts
│   │   ├── delivery.ts
│   │   ├── inventory.ts
│   │   ├── order.ts
│   │   ├── payment.ts
│   │   ├── prescription.ts
│   │   ├── settings.ts
│   │   ├── todo.ts
│   │   ├── user.ts
│   │   └── visit.ts
│   ├── routes/             # Express routes
│   │   ├── auth.ts
│   │   ├── bills.ts
│   │   ├── branches.ts
│   │   ├── cache-admin.ts
│   │   ├── customers.ts
│   │   ├── dashboard.ts
│   │   ├── delivery.ts
│   │   ├── index.ts
│   │   ├── inventory.ts
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   ├── prescriptions.ts
│   │   ├── recalculate.ts
│   │   ├── reports.ts
│   │   ├── settings.ts
│   │   ├── todos.ts
│   │   ├── visits.ts
│   │   ├── whatsapp.ts
│   │   └── workspace.ts
│   ├── scripts/            # Utility scripts
│   │   ├── clear-falka.ts
│   │   ├── fix-branch-migration.ts
│   │   ├── migrate-branches.ts
│   │   └── recalculate-customers.ts
│   ├── services/           # Business services
│   │   ├── cache.ts
│   │   └── whatsapp.ts
│   └── utils/              # Utility functions
│       ├── asyncLocalStorage.ts
│       ├── branchProxy.ts
│       ├── jwt.ts
│       ├── pdf.ts
│       ├── qr.ts
│       ├── recalculate.ts
│       ├── regex.ts
│       ├── requestContext.ts
│       └── response.ts
```

### Server File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Entry points | `index.ts` | `index.ts` |
| App config | `app.ts` | `app.ts` |
| Config | `config.ts` | `config.ts` |
| Controllers | `*Controller.ts` | `authController.ts` |
| Middleware | camelCase | `auth.ts`, `branch.ts` |
| Models | camelCase (singular) | `customer.ts`, `order.ts` |
| Routes | camelCase (plural) | `customers.ts`, `orders.ts` |
| Services | camelCase | `cache.ts`, `whatsapp.ts` |
| Utils | camelCase | `jwt.ts`, `response.ts` |
| Scripts | camelCase | `recalculate-customers.ts` |
| Migrations | camelCase | `migrate-legacy.ts` |

### Server Layer Organization

**Routes** (`routes/`):
- Handle HTTP requests/responses
- Apply middleware
- Validate inputs
- Delegate to controllers/services
- Format responses

**Controllers** (`controllers/`):
- Implement business logic
- Coordinate between models
- Handle complex workflows
- Currently minimal (3 files)

**Services** (`services/`):
- Implement business services
- Handle external integrations
- Examples: cache, WhatsApp

**Models** (`models/`):
- Define data schemas
- Define relationships
- Define indexes
- Provide query methods

**Middleware** (`middleware/`):
- Handle cross-cutting concerns
- Authentication, authorization, caching, etc.

**Utils** (`utils/`):
- Pure utility functions
- JWT, response formatting, etc.

**Scripts** (`scripts/`):
- One-time utility scripts
- Migrations, data fixes, etc.

## Warehouse Structure (`warehouse/`)

```
warehouse/
├── .env                    # Environment variables
├── .env.example            # Example environment variables
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── postcss.config.cjs      # PostCSS configuration
├── tailwind.config.cjs     # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # Node TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── dist/                   # Production build output
├── node_modules/           # Dependencies
└── src/
    ├── main.tsx            # Application entry point
    ├── App.tsx             # Root component with routing
    ├── api.ts              # API client and endpoints
    ├── constants.ts        # Application constants
    ├── index.css           # Global styles
    ├── components/         # Reusable UI components
    │   ├── index.ts        # Barrel exports
    │   ├── Layout.tsx
    │   ├── ProtectedRoute.tsx
    │   ├── Spinner.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── Badge.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── DeleteConfirmModal.tsx
    │   ├── EmptyState.tsx
    │   ├── FilterSelect.tsx
    │   ├── InventoryFilters.tsx
    │   ├── InventoryFormModal.tsx
    │   ├── InventoryTable.tsx
    │   ├── ItemRow.tsx
    │   ├── LoadingOverlay.tsx
    │   ├── Logo.tsx
    │   ├── Modal.tsx
    │   ├── PageHeader.tsx
    │   ├── PageLoader.tsx
    │   ├── Pagination.tsx
    │   ├── QuickAction.tsx
    │   ├── SearchInput.tsx
    │   ├── SectionHeader.tsx
    │   ├── Skeleton.tsx
    │   ├── StatCard.tsx
    │   ├── StatusBar.tsx
    │   ├── ThemeToggle.tsx
    │   └── WithdrawModal.tsx
    ├── context/            # React Context providers
    │   ├── index.ts
    │   ├── AuthContext.tsx
    │   ├── ThemeContext.tsx
    │   └── ToastContext.tsx
    ├── hooks/              # Custom React hooks
    │   ├── index.ts
    │   ├── useApi.ts
    │   ├── useClickOutside.ts
    │   ├── useDebounce.ts
    │   ├── useKeyboard.ts
    │   ├── useLocalStorage.ts
    │   ├── usePagination.ts
    │   └── useSorting.ts
    ├── pages/              # Page components
    │   ├── Dashboard.tsx
    │   ├── Inventory.tsx
    │   ├── Users.tsx
    │   ├── Login.tsx
    │   └── Register.tsx
    ├── types/              # TypeScript type definitions
    │   ├── index.ts
    │   └── inventory.ts
    └── utils/              # Utility functions
        └── helpers.ts
```

## File Purpose Summary

### Critical Files (Never modify without careful consideration)

| File | Purpose | Risk Level |
|------|---------|-----------|
| `server/src/models/db.ts` | Multi-tenant database system | Critical |
| `server/src/utils/branchProxy.ts` | Branch routing proxy | Critical |
| `server/src/middleware/branch.ts` | Branch scope middleware | Critical |
| `server/src/middleware/auth.ts` | Authentication middleware | Critical |
| `server/src/config.ts` | Configuration constants | High |
| `server/src/index.ts` | Server startup and seeding | High |

### High-Impact Files

| File | Purpose | Risk Level |
|------|---------|-----------|
| `server/src/routes/orders.ts` | Order processing (587 lines) | High |
| `server/src/routes/bills.ts` | Bill processing | High |
| `server/src/routes/payments.ts` | Payment processing | High |
| `server/src/routes/dashboard.ts` | Dashboard aggregation | High |
| `server/src/routes/workspace.ts` | Atomic transactions | High |
| `server/src/services/whatsapp.ts` | WhatsApp integration | High |

### Low-Risk Files

| File | Purpose | Risk Level |
|------|---------|-----------|
| `client/src/components/Skeleton.tsx` | Loading skeleton | Low |
| `client/src/components/StatCard.tsx` | Statistics card | Low |
| `warehouse/src/components/Spinner.tsx` | Loading spinner | Low |
| `warehouse/src/components/Badge.tsx` | Status badge | Low |

## Adding New Files

### When Adding a New Route

1. Create `server/src/routes/newFeature.ts`
2. Import in `server/src/routes/index.ts`
3. Mount at `/api/newFeature`
4. Follow existing patterns in other route files

### When Adding a New Model

1. Create `server/src/models/newFeature.ts`
2. Add to `server/src/models/db.ts` `BranchModels` interface
3. Add to `getBranchModels()` function
4. Follow existing patterns in other model files

### When Adding a New Page

1. Create `client/src/pages/NewPage.tsx`
2. Add route in `client/src/App.tsx`
3. Add navigation in `client/src/components/Layout.tsx`
4. Follow existing patterns in other page files

### When Adding a New Component

1. Create `client/src/components/NewComponent.tsx`
2. Follow existing naming conventions
3. Use TypeScript interfaces for props
4. Use default exports

## Cross-References

- **Coding standards**: See `docs/05-coding-standards.md`
- **Naming conventions**: See `docs/06-naming-conventions.md`
- **Backend architecture**: See `docs/07-backend.md`
- **Frontend architecture**: See `docs/08-frontend.md`
- **Database architecture**: See `docs/12-database.md`

## AI Instructions

When working on this project:
1. Always place files in the correct directory
2. Follow naming conventions exactly
3. Don't create files in the wrong location
4. Don't create unnecessary files
5. Always update barrel exports when adding new files
6. Always update route/index.ts when adding new routes
