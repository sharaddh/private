# KMJ Optical ERP - Complete Project Specification

## Purpose

This document provides a complete technical specification of the KMJ Optical ERP system. Every AI agent and engineer must read this before making any changes. This is the single source of truth for what the system does.

## Business Context

KMJ Optical is a multi-branch optical shop chain. The ERP system manages the complete lifecycle of optical retail operations: customer intake, eye prescriptions, order processing, billing, payment collection, inventory management, delivery tracking, and business analytics.

The system operates in the Indian market (INR currency, Hindi language support, Indian phone formats) and supports WhatsApp integration for customer communication.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Main ERP    │  │  Warehouse   │  │  Mobile      │      │
│  │  (React)     │  │  (React)     │  │  (Responsive)│      │
│  │  Port 5173   │  │  Port 5174   │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼───────┐                         │
│                    │  Express API  │                         │
│                    │  Port 4000    │                         │
│                    └───────┬───────┘                         │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐      │
│  │   MongoDB    │  │    Redis     │  │   WhatsApp   │      │
│  │  (Primary)   │  │   (Cache)    │  │  (Baileys)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 18.2 | UI library |
| Frontend | TypeScript | - | Type safety |
| Frontend | Vite | 4.5 | Build tool |
| Frontend | React Router | 6 | Client routing |
| Frontend | Tailwind CSS | 3 | Styling |
| Frontend | Recharts | - | Charts |
| Frontend | jsPDF | - | PDF generation |
| Frontend | html5-qrcode | - | QR scanning |
| Backend | Node.js | 16+ | Runtime |
| Backend | Express | - | HTTP framework |
| Backend | TypeScript | - | Type safety |
| Backend | Mongoose | - | MongoDB ODM |
| Backend | JWT | - | Authentication |
| Backend | Zod | - | Validation |
| Backend | bcrypt | - | Password hashing |
| Backend | PDFKit | - | Server PDF generation |
| Backend | Baileys | - | WhatsApp integration |
| Database | MongoDB | 8.x | Primary database |
| Cache | Redis | - | Optional caching |
| Warehouse | React | 18.2 | Warehouse UI |

## Multi-Tenant Architecture

### Branch-Based Data Isolation

The system uses a database-per-branch architecture:

- **Root Database** (`kmj`): Contains `User` and `Branch` collections only
- **Branch Databases** (`kmj_{branchCode}`): Contains all business data

### Branch Model Proxy System

Every business model (Customer, Visit, Prescription, Order, Bill, Payment, Inventory, Delivery, Settings, Todo) is wrapped with a JavaScript `Proxy` that intercepts all operations and routes them to the correct branch database based on `AsyncLocalStorage` context.

### How Branch Routing Works

1. Client sends `x-branch-id` header or `_branch` query parameter
2. `branchScope` middleware validates the branch exists and is active
3. Middleware creates `BranchModels` instance for that branch database
4. Models stored in both `req.branchModels` and `AsyncLocalStorage` context
5. All model operations automatically route to the correct database

## Complete Data Models

### User (Root Database)

| Field | Type | Constraints |
|-------|------|------------|
| username | String | required, unique |
| passwordHash | String | required |
| name | String | default "" |
| mobile | String | default "" |
| role | String | enum: ["owner", "staff", "warehouse"] |
| branches | [ObjectId] | ref: "Branch" |

### Branch (Root Database)

| Field | Type | Constraints |
|-------|------|------------|
| name | String | required |
| code | String | required, unique |
| address | String | default "" |
| phone | String | default "" |
| email | String | default "" |
| dbName | String | required |
| isActive | Boolean | default true |
| settings.shopName | String | default "" |
| settings.shopAddress | String | default "" |
| settings.shopPhone | String | default "" |
| settings.shopEmail | String | default "" |
| settings.adminWhatsApp | String | default "" |
| settings.logo | String | default "" |

### Customer (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | String | indexed |
| name | String | required, indexed |
| email | String | optional |
| age | Number | optional |
| gender | String | optional |
| mobile | String | indexed |
| alternateMobile | String | optional |
| address | String | optional |
| city | String | optional |
| tags | [String] | default [] |
| totalVisits | Number | default 0 |
| totalSpent | Number | default 0, indexed |
| pendingAmount | Number | default 0 |

### Visit (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | ObjectId | required, ref: "Customer", indexed |
| visitDate | Date | default Date.now, indexed |
| visitType | String | enum: ["new", "frame_change", "new_lens", "contact_lens", "service", "other"] |
| doctorName | String | optional |
| shop | String | optional |
| shopId | ObjectId | optional |
| remarks | String | optional |

### Prescription (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | ObjectId | required, ref: "Customer" |
| visitId | ObjectId | ref: "Visit" |
| rightEye.dv | EyeSchema | { sph, cyl, axis, va } |
| rightEye.nv | EyeSchema | { sph, cyl, axis, va } |
| rightEye.pc | EyeSchema | { sph, cyl, axis, va } |
| leftEye.dv | EyeSchema | { sph, cyl, axis, va } |
| leftEye.nv | EyeSchema | { sph, cyl, axis, va } |
| leftEye.pc | EyeSchema | { sph, cyl, axis, va } |
| pd | String | optional |
| notes | String | optional |

### Order (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | ObjectId | required, ref: "Customer", indexed |
| visitId | ObjectId | ref: "Visit" |
| frame | String | optional |
| frameBrand | String | optional |
| frameModel | String | optional |
| frameColor | String | optional |
| frameSize | String | optional |
| framePrice | Number | default 0 |
| lens | String | optional |
| lensBrand | String | optional |
| lensType | String | optional |
| lensIndex | String | optional |
| lensPrice | Number | default 0 |
| coating | String | optional |
| coatingPrice | Number | default 0 |
| accessories | [String] | default [] |
| quantity | Number | default 1 |
| forwardedCount | Number | default 0 |
| deliveryDate | Date | optional |
| actualDeliveryDate | Date | optional |
| status | String | enum: ["Draft","Ordered","In Lab","Ready","Delivered","Cancelled"] |
| labAssigned | String | optional |
| labExpectedDate | Date | optional |
| labRemarks | String | optional |
| reviewed | Boolean | default false |
| classification | String | enum: ["pending", "stock", "buy", "order"] |
| rightLensStatus | String | enum: ["pending", "stock", "buy", "order"] |
| leftLensStatus | String | enum: ["pending", "stock", "buy", "order"] |

### Order Status State Machine

```
Draft ──────► Ordered ──────► In Lab ──────► Ready ──────► Delivered
  │              │              │              │
  └──► Cancelled ◄──────────────┴──────────────┴──► Cancelled (from any non-terminal)
```

Valid transitions:
- Draft → Ordered, Cancelled
- Ordered → In Lab, Cancelled
- In Lab → Ready, Cancelled
- Ready → Delivered, Cancelled
- Delivered → (terminal)
- Cancelled → (terminal)

### Bill (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| billNumber | String | indexed, unique |
| customerId | ObjectId | required, ref: "Customer", indexed |
| visitId | ObjectId | ref: "Visit" |
| items | [BillItem] | [{ description, quantity, unitPrice, total }] |
| subtotal | Number | default 0 |
| discount | Number | default 0 |
| tax | Number | default 0 |
| advancePaid | Number | default 0 |
| pendingAmount | Number | default 0, indexed |
| totalAmount | Number | default 0 |
| status | String | enum: ["Active","Cancelled"] |

### Payment (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | ObjectId | required, ref: "Customer" |
| billId | ObjectId | ref: "Bill" |
| amount | Number | required, min: 0.01 |
| paymentMode | String | enum: ["Cash","UPI","Card","Bank Transfer","नकद","कार्ड","बैंक","बीमा","Insurance"] |
| paymentDate | Date | default Date.now |
| notes | String | optional |

### Inventory (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| sku | String | indexed, unique |
| category | String | enum: ["Frame", "Lens", "Accessories"] |
| inventoryType | String | enum: ["spectacles","sunglasses","lens","accessory","hearing-aid","cleaner","case","other"] |
| brand | String | optional |
| model | String | optional |
| color | String | optional |
| size | String | optional |
| gender | String | enum: ["Male","Female","Unisex",""] |
| supplier | String | optional |
| quantity | Number | default 0 |
| location | String | enum: ["shop","warehouse"] |
| purchasePrice | Number | default 0 |
| sellingPrice | Number | default 0 |
| description | String | optional |

### Delivery (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| customerId | ObjectId | required, ref: "Customer", indexed |
| orderId | ObjectId | ref: "Order" |
| address | String | optional |
| expectedDeliveryDate | Date | optional |
| actualDeliveryDate | Date | optional |
| status | String | enum: ["Pending","In Transit","Ready","Delivered","Cancelled"] |

### Settings (Branch Database)

| Field | Type | Default |
|-------|------|---------|
| shopName | String | "KMJ Optical" |
| shopAddress | String | "" |
| shopPhone | String | "" |
| shopEmail | String | "" |
| adminWhatsApp | String | "" |
| logo | String | "" |

### Todo (Branch Database)

| Field | Type | Constraints |
|-------|------|------------|
| task | String | required |
| done | Boolean | default false |
| notes | String | optional |

## Complete API Endpoints

### Authentication (`/api/auth`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /register | authenticate (owner) | Register user |
| POST | /login | None | Admin login |
| POST | /staff-login | None | Staff login |
| POST | /warehouse-login | None | Warehouse login |
| POST | /warehouse-register | authenticate | Register warehouse user |
| POST | /refresh | None | Refresh token |
| GET | /me | authenticate | Get profile |
| PUT | /me | authenticate | Update profile |
| GET | /users | authenticate (owner) | List users |
| GET | /warehouse-users | authenticate | List warehouse users |
| PUT | /users/:id | authenticate | Update user |
| DELETE | /users/:id | authenticate | Delete user |

### Branches (`/api/branches`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /active | None | Active branches |
| GET | / | authenticate | All branches |
| GET | /:id | authenticate | Branch by ID |
| POST | / | authenticate | Create branch |
| PUT | /:id | authenticate | Update branch |
| DELETE | /:id | authenticate | Soft-delete branch |

### Customers (`/api/customers`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(60) |
| POST | / | authenticate | - |
| GET | /summary/:id | authenticate | cacheRoute(30) |
| GET | /:id | authenticate | - |
| PUT | /:id | authenticate | - |
| DELETE | /:id | authenticate | - |

### Visits (`/api/visits`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(30) |
| POST | / | authenticate | Zod validation |
| GET | /:id | authenticate | - |
| PUT | /:id | authenticate | - |
| DELETE | /:id | authenticate | - |

### Prescriptions (`/api/prescriptions`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(30) |
| POST | / | authenticate | Zod validation |
| GET | /:id | authenticate | - |
| PUT | /:id | authenticate | - |
| DELETE | /:id | authenticate | - |

### Orders (`/api/orders`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(30) |
| POST | / | authenticate | audit |
| GET | /:id | authenticate | - |
| PUT | /:id | authenticate | audit |
| PATCH | /:id/classify | authenticate | - |
| PATCH | /:id/classify-eye | authenticate | - |
| PATCH | /:id/review | authenticate | - |
| PATCH | /:id/status | authenticate | - |
| DELETE | /:id | authenticate | audit |
| POST | /demand-send | authenticate | - |

### Bills (`/api/bills`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(30) |
| POST | / | authenticate | audit, Zod |
| GET | /:id | authenticate | - |
| PUT | /:id | authenticate | audit |
| DELETE | /:id | authenticate | audit |

### Payments (`/api/payments`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | / | authenticate | cacheRoute(30) |
| POST | / | authenticate | audit, Zod |
| PUT | /:id | authenticate | audit |
| DELETE | /:id | authenticate | audit |

### Inventory (`/api/inventory`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | /stats | authenticate | - |
| GET | / | authenticate | cacheRoute(60) |
| GET | /:id | authenticate | - |
| GET | /qr/:code | authenticate | - |
| GET | /:id/qr-image | authenticate | - |
| POST | / | authenticate | audit |
| PUT | /:id/stock | authenticate | audit |
| PUT | /:id | authenticate | audit |
| DELETE | /:id | authenticate | audit |

### Delivery (`/api/delivery`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | / | authenticate | List deliveries |
| GET | /:id | authenticate | Get delivery |

### Settings (`/api/settings`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | / | authenticate | Get settings |
| PUT | / | authenticate | Update settings |

### Todos (`/api/todos`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | / | authenticate | List todos |
| POST | / | authenticate | Create todo |
| PATCH | /:id | authenticate | Update todo |
| DELETE | /:id | authenticate | Delete todo |

### Dashboard (`/api/dashboard`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | /stats | authenticate | cacheRoute(30) |

### Reports (`/api/reports`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| GET | /revenue | authenticate | cacheRoute(60) |
| GET | /monthly | authenticate | cacheRoute(120) |
| GET | /customers | authenticate | cacheRoute(120) |
| GET | /inventory | authenticate | cacheRoute(60) |
| GET | /deliveries | authenticate | cacheRoute(30) |

### Workspace (`/api/workspace`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /transaction | authenticate | Atomic transaction |

### WhatsApp (`/api/whatsapp`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /status | authenticate | Connection status |
| GET | /qr | authenticate | QR code |
| GET | /queue | authenticate | Message queue |
| POST | /send | authenticate | Send text |
| POST | /send-media | authenticate | Send media |
| POST | /disconnect | authenticate | Disconnect |
| POST | /pair | authenticate | Pairing code |
| POST | /init | authenticate | Reinitialize |
| POST | /broadcast | authenticate | Broadcast messages |
| POST | /broadcast/abort | authenticate | Abort broadcast |

### Cache Admin (`/api/cache`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /status | authenticate | Redis status |
| POST | /flush | authenticate | Flush cache |

### Recalculate (`/api/recalculate`)

| Method | Path | Auth | Middleware |
|--------|------|------|-----------|
| POST | /customer-totals | authenticate | requireRole("owner") |

## Client Application Structure

### Main ERP Client (Port 5173)

**Pages:**
- Dashboard - Business overview with charts and stats
- Customers - Customer list with search and filters
- CustomerDetail - Customer profile with visits, prescriptions, orders, bills
- CustomerNewVisit - New visit workflow (visit + prescription + order + bill + payment)
- Orders - Order list with status management
- Bills - Bill list with PDF generation
- Payments - Payment records
- InventoryPage - Inventory management with QR codes
- Delivery - Delivery tracking
- Pickup - Pickup management
- Reports - Business analytics
- Settings - Shop settings, user management
- WhatsApp - WhatsApp integration management
- Workspace - Complete transaction workflow
- Login/Register - Authentication
- StaffLogin - Staff-specific login
- ItemScan - QR code scanning
- Announcement - Internal announcements

**Shared Components:**
- Layout - App shell with sidebar
- Modal - Reusable modal
- Table - Data table with sorting
- Form - Form components
- Toast - Notification system
- Skeleton - Loading skeletons
- RoleGuard - Route-level access control
- DateRangePicker - Date range selection
- DashboardCharts - Recharts visualizations
- CameraScanner - QR code scanning

### Warehouse App (Port 5174)

**Pages:**
- Dashboard - Warehouse stats overview
- Inventory - Lens inventory management
- Users - Warehouse user management
- Login - Warehouse login
- Register - Warehouse user registration

**Key Differences from Main Client:**
- Lens-only inventory focus
- No branch concept
- Separate authentication (wh_ prefixed tokens)
- Richer UI component library (33 components)
- Built-in request timeout and retry logic
- Mobile-responsive with bottom navigation

## Authentication Flow

### JWT Token System

- **Access Token**: Expires in 24h (configurable via `JWT_ACCESS_EXPIRY`)
- **Refresh Token**: Expires in 7d (configurable via `JWT_REFRESH_EXPIRY`)
- **Signing**: Both use same `JWT_SECRET`

### Login Flow

1. Client sends credentials to `/api/auth/login` or `/api/auth/staff-login`
2. Server validates credentials against database
3. Server returns `{ accessToken, refreshToken, user }`
4. Client stores tokens in localStorage
5. Client sends `Authorization: Bearer {accessToken}` on subsequent requests
6. On 401, client uses refresh token to get new access token

### Branch Scoping Flow

1. Client selects branch (or auto-detected for staff)
2. Client sends `x-branch-id` header on all requests
3. Server middleware validates branch exists and is active
4. All subsequent database operations route to branch database

## Caching Strategy

### Redis Cache (Optional)

- Gracefully degrades if Redis unavailable
- Key prefix: `route:`
- Branch-aware keys: `{branchId}:{path}`

### Cache TTLs

| Data | TTL |
|------|-----|
| Dashboard | 30s |
| Orders | 30s |
| Bills | 30s |
| Payments | 30s |
| Deliveries | 30s |
| Visits | 30s |
| Prescriptions | 30s |
| Customers | 60s |
| Inventory | 60s |
| Reports (revenue) | 60s |
| Reports (monthly) | 120s |
| Reports (customers) | 120s |

### Invalidation Strategy

- All mutations invalidate relevant cache keys
- All mutations invalidate `/api/dashboard` cache
- Some routes use `await` (customers), others fire-and-forget (orders)

## Known Technical Debt

### Critical

1. JWT access and refresh tokens share same secret
2. No role-based branch access control (any user can access any branch)
3. Race conditions in financial operations (no transactions)
4. Dashboard N+1 query problem (23+ queries in single request)

### Moderate

5. Inconsistent cache invalidation (some `await`, some don't)
6. Hardcoded default credentials (`admin123`)
7. Inconsistent error handling in order status updates
8. Bill PUT uses `Object.assign` without field whitelist
9. Branch creation lacks role check
10. Dead code (`CACHE_TTL` in config.ts)

### Minor

11. Mixed Zod and manual validation
12. No request body size validation for WhatsApp media
13. Proxy performance overhead on every model operation
14. No pagination on most list endpoints
15. Regex injection risk in customer search
16. Bill number collision risk
17. No HTTPS enforcement
18. WhatsApp auth stored in root DB (coupling)
19. Missing cache invalidation on some routes
20. O(n) queries for user listing with branches

## Deployment

### Platform

- **Hosting**: Render.com
- **Database**: MongoDB Atlas (or self-hosted)
- **Cache**: Redis (optional, for Render paid tier)

### Environment Variables

**Server:**
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default 4000)
- `REDIS_URL` - Redis connection string (optional)
- `NODE_ENV` - Environment (development/production)

**Client:**
- `VITE_API_URL` - API base URL

**Warehouse:**
- `VITE_API_URL` - API base URL

### Build Commands

```bash
# Install all dependencies
npm run install-all

# Development (all services)
npm run dev

# Production build
npm run build

# Production start
npm start
```

## Business Workflows

### Complete Transaction Flow (Workspace)

1. Customer arrives at shop
2. Staff creates visit record
3. Doctor performs eye examination
4. Staff enters prescription (right/left eye, DV/NV/PC)
5. Staff selects frame and lens from inventory
6. System calculates pricing (frame + lens + coating + accessories)
7. Staff creates order with delivery date
8. System generates bill with line items
9. Customer pays advance or full amount
10. System records payment
11. Order moves through status pipeline (Draft → Ordered → In Lab → Ready → Delivered)
12. WhatsApp notifications sent at key milestones
13. Delivery recorded when customer collects

### Order Lifecycle

1. **Draft**: Order created, not yet submitted to lab
2. **Ordered**: Frame/lens ordered from suppliers
3. **In Lab**: Lab is processing the order
4. **Ready**: Finished product ready for pickup/delivery
5. **Delivered**: Customer has received the order
6. **Cancelled**: Order cancelled at any stage

### Payment Flow

1. Bill created with `totalAmount` and optional `advancePaid`
2. `pendingAmount = totalAmount - advancePaid`
3. Payments reduce `pendingAmount` on both bill and customer
4. Multiple partial payments supported
5. Payment modes: Cash, UPI, Card, Bank Transfer, Insurance (Hindi variants supported)

## Future Considerations

1. **Real-time updates**: WebSocket support for live dashboard
2. **Offline support**: Service worker for offline capability
3. **Multi-language**: Full Hindi/regional language support
4. **Mobile apps**: React Native companion apps
5. **Advanced analytics**: ML-powered demand forecasting
6. **Supplier integration**: Direct API connections to lens suppliers
7. **Insurance integration**: Direct insurance claim processing
8. **Loyalty program**: Customer reward points system
