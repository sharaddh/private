# KMJ Optical ERP — Dependency Map

> Complete dependency inventory for all three applications (server, client, warehouse)
> with purposes, versions, internal module dependencies, and external service dependencies.

---

## Table of Contents

1. [Root Dependencies](#1-root-dependencies)
2. [Server Dependencies](#2-server-dependencies)
3. [Client Dependencies](#3-client-dependencies)
4. [Warehouse Dependencies](#4-warehouse-dependencies)
5. [External Service Dependencies](#5-external-service-dependencies)
6. [Internal Module Dependency Graph](#6-internal-module-dependency-graph)
7. [Environment Variables](#7-environment-variables)

---

## 1. Root Dependencies

**File:** `package.json`
**Package name:** `kmj-erp`
**Version:** `1.0.0`

### Production Dependencies

| Package | Version | Purpose | Last Updated |
|---------|---------|---------|--------------|
| `motion` | `^12.42.2` | Animation library (alias for framer-motion) | 2025 |

### Dev Dependencies

| Package | Version | Purpose | Last Updated |
|---------|---------|---------|--------------|
| `concurrently` | `^8.2.0` | Run multiple npm scripts simultaneously (server + client + warehouse) | 2023 |

### Root Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `install-all` | `npm install && npm install --prefix client && npm install --prefix server && npm install --prefix warehouse` | Install all dependencies across projects |
| `dev` | `concurrently -n server,client,warehouse ...` | Start all three dev servers in parallel |
| `build` | `npm run build --prefix client && npm run build --prefix server && npm run build --prefix warehouse` | Build all projects |
| `start` | `npm start --prefix server` | Start production server |

---

## 2. Server Dependencies

**File:** `server/package.json`
**Package name:** `kmj-erp-server`
**Version:** `0.1.0`

### Production Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `@whiskeysockets/baileys` | `^6.17.16` | WhatsApp Web reverse-engineering library for messaging | External Service |
| `bcrypt` | `^5.1.0` | Password hashing (salt rounds: 10) | Security |
| `compression` | `^1.8.1` | HTTP response compression (gzip level 6) | Performance |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing middleware | Security |
| `dotenv` | `^16.3.1` | Environment variable loading from .env files | Configuration |
| `express` | `^4.18.2` | Web framework for Node.js | Core |
| `express-rate-limit` | `^6.11.0` | Rate limiting middleware (1000 req/min, per-user for authenticated) | Security |
| `helmet` | `^7.0.0` | Security headers middleware | Security |
| `ioredis` | `^5.11.1` | Redis client for caching | Performance |
| `jsonwebtoken` | `^9.0.0` | JWT token creation and verification | Security |
| `mongoose` | `^7.5.0` | MongoDB ODM (Object Document Mapper) | Database |
| `pdfkit` | `^0.19.1` | PDF generation library (bills, demand lists) | Document Generation |
| `pino` | `^9.14.0` | Structured JSON logging | Logging |
| `pino-http` | `^10.5.0` | Request logging middleware with `x-request-id` | Logging |
| `rate-limit-redis` | `^4.3.1` | Redis-backed rate limit store | Security |
| `qrcode` | `^1.5.4` | QR code generation (inventory QR, WhatsApp QR) | Document Generation |
| `zod` | `^4.4.3` | Request body validation schema library | Validation |

### Dev Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `@types/bcrypt` | `^5.0.0` | TypeScript type definitions for bcrypt | Types |
| `@types/compression` | `^1.8.1` | TypeScript type definitions for compression | Types |
| `@types/cors` | `^2.8.18` | TypeScript type definitions for cors | Types |
| `@types/express` | `^4.17.21` | TypeScript type definitions for express | Types |
| `@types/jsonwebtoken` | `^9.0.2` | TypeScript type definitions for jsonwebtoken | Types |
| `@types/pdfkit` | `^0.17.6` | TypeScript type definitions for pdfkit | Types |
| `@types/qrcode` | `^1.5.6` | TypeScript type definitions for qrcode | Types |
| `eslint` | `^10.8.1` | Linting | Quality |
| `typescript-eslint` | `^8.67.0` | TypeScript ESLint config | Quality |
| `eslint-config-prettier` | `^10.1.8` | Disables conflicting ESLint rules | Quality |
| `prettier` | `^3.9.6` | Code formatter | Quality |
| `pino-pretty` | `^11.3.0` | Pretty-print pino logs in development | Development |
| `vitest` | `^2.1.9` | Unit testing framework | Testing |
| `ts-node-dev` | `^2.0.0` | TypeScript execution with auto-reload | Development |
| `typescript` | `5.2.2` | TypeScript compiler (pinned version) | Build |

### Server Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `ts-node-dev --respawn --transpile-only src/index.ts` | Development server with auto-reload |
| `build` | `tsc -p tsconfig.json` | Compile TypeScript to JavaScript |
| `start` | `node dist/index.js` | Start production server |
| `migrate` | `ts-node src/migrations/migrate-legacy.ts` | Run legacy data migration |
| `recalculate` | `ts-node src/scripts/recalculate-customers.ts` | Recalculate customer denormalized fields |

---

## 3. Client Dependencies

**File:** `client/package.json`
**Package name:** `kmj-erp-client`
**Version:** `0.1.0`

### Production Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `framer-motion` | `^12.42.2` | React animation library | UI |
| `html5-qrcode` | `^2.3.8` | HTML5 QR code scanner (camera-based) | Scanning |
| `jspdf` | `^4.2.1` | Client-side PDF generation | Document Generation |
| `jspdf-autotable` | `^5.0.8` | Auto-table plugin for jsPDF | Document Generation |
| `jsqr` | `^1.4.0` | QR code decoding from image data | Scanning |
| `lucide-react` | `^1.21.0` | Icon library (Lucide icons) | UI |
| `qrcode` | `^1.5.4` | QR code generation (inventory labels) | Document Generation |
| `react` | `18.2.0` | UI library (pinned version) | Core |
| `react-dom` | `18.2.0` | React DOM renderer (pinned version) | Core |
| `react-router-dom` | `6.14.1` | Client-side routing | Routing |
| `recharts` | `^3.9.0` | Charting library (dashboard charts) | UI |

### Dev Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `@types/qrcode` | `^1.5.6` | TypeScript type definitions for qrcode | Types |
| `@types/react` | `^18.2.28` | TypeScript type definitions for react | Types |
| `@types/react-dom` | `^18.2.11` | TypeScript type definitions for react-dom | Types |
| `@vitejs/plugin-react` | `^4.0.0` | Vite plugin for React JSX transform | Build |
| `autoprefixer` | `^10.4.14` | CSS vendor prefix automation | CSS |
| `postcss` | `^8.4.33` | CSS transformation tool | CSS |
| `tailwindcss` | `^3.3.5` | Utility-first CSS framework | CSS |
| `typescript` | `^5.2.2` | TypeScript compiler | Build |
| `vite` | `^4.5.0` | Fast build tool and dev server | Build |

### Client Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start Vite dev server (port 5173) |
| `build` | `vite build` | Build for production |
| `preview` | `vite preview` | Preview production build |

---

## 4. Warehouse Dependencies

**File:** `warehouse/package.json`
**Package name:** `warehouse-app`
**Version:** `0.1.0`

### Production Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `lucide-react` | `^1.21.0` | Icon library | UI |
| `react` | `18.2.0` | UI library (pinned version) | Core |
| `react-dom` | `18.2.0` | React DOM renderer (pinned version) | Core |
| `react-router-dom` | `6.14.1` | Client-side routing | Routing |

### Dev Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `@types/react` | `^18.2.28` | TypeScript type definitions for react | Types |
| `@types/react-dom` | `^18.2.11` | TypeScript type definitions for react-dom | Types |
| `@vitejs/plugin-react` | `^4.0.0` | Vite plugin for React JSX transform | Build |
| `autoprefixer` | `^10.4.14` | CSS vendor prefix automation | CSS |
| `postcss` | `^8.4.33` | CSS transformation tool | CSS |
| `tailwindcss` | `^3.3.5` | Utility-first CSS framework | CSS |
| `typescript` | `^5.2.2` | TypeScript compiler | Build |
| `vite` | `^4.5.0` | Fast build tool and dev server | Build |

### Warehouse Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start Vite dev server (port 5174) |
| `build` | `vite build` | Build for production |
| `preview` | `vite preview` | Preview production build |

---

## 5. External Service Dependencies

### 5.1 MongoDB

| Attribute | Value |
|-----------|-------|
| Driver | `mongoose@^7.5.0` |
| Connection | `MONGO_URI` environment variable |
| Default | `mongodb://localhost:27017/kmj-erp` |
| Pool Size | 10 connections |
| Server Selection Timeout | 5000ms |
| Socket Timeout | 45000ms |
| Multi-Branch | Uses `connection.useDb(dbName)` for branch isolation |

**Collections Used:**
| Collection | Branch-Scoped | Model |
|------------|---------------|-------|
| `customers` | Yes | Customer |
| `visits` | Yes | Visit |
| `prescriptions` | Yes | Prescription |
| `orders` | Yes | Order |
| `bills` | Yes | Bill |
| `payments` | Yes | Payment |
| `inventory` | Yes | Inventory |
| `deliveries` | Yes | Delivery |
| `settings` | Yes | Settings |
| `todos` | Yes | Todo |
| `users` | No (global) | User |
| `branches` | No (global) | Branch |
| `baileys_auth` | No (global) | WhatsApp auth state (legacy) |
| `baileys_auth_{branchId}` | Per-branch | WhatsApp auth state |

**Database Architecture:**
```
Main Database (kmj-erp):
  ├── users (global)
  ├── branches (global)
  └── baileys_auth (legacy WhatsApp)

Branch Database (kmj_govindpuri):
  ├── customers
  ├── visits
  ├── prescriptions
  ├── orders
  ├── bills
  ├── payments
  ├── inventory
  ├── deliveries
  ├── settings
  ├── todos
  └── baileys_auth_{branchId} (WhatsApp)

Branch Database (kmj_{branch2}):
  └── (same collections)
```

### 5.2 Redis

| Attribute | Value |
|-----------|-------|
| Client | `ioredis@^5.11.1` |
| Connection | `REDIS_URL` environment variable |
| Optional | Yes — system works without Redis (no caching) |
| Max Retries | 3 |
| Retry Strategy | `min(times * 200, 1000)` ms |
| Lazy Connect | Yes |
| Connect Timeout | 10000ms |
| Key Prefix | `route:` |

**Cache Operations:**
| Operation | Method | Notes |
|-----------|--------|-------|
| Get | `GET route:{branchId}:{url}` | JSON parsed |
| Set | `SETEX route:{branchId}:{url} {ttl} {json}` | TTL in seconds |
| Delete | `SCAN + DEL` with pattern | Branch-aware deletion |
| Flush All | `SCAN + DEL route:*` | Clears all cached routes |

### 5.3 WhatsApp (Baileys)

| Attribute | Value |
|-----------|-------|
| Library | `@whiskeysockets/baileys@^6.17.16` |
| Protocol | WhatsApp Web (reverse-engineered) |
| Auth Storage | MongoDB (persistent across restarts) |
| Browser Identity | macOS Chrome |
| QR Timeout | 120 seconds |
| Max Reconnect | 5 attempts |
| Reconnect Base Delay | 5000ms (exponential) |
| Keep-Alive | 30000ms |
| Connect Timeout | 120000ms |

**WhatsApp Features Used:**
| Feature | Implementation |
|---------|----------------|
| Text messaging | `sock.sendMessage(jid, { text })` |
| Image sending | `sock.sendMessage(jid, { image: buffer, caption })` |
| Document sending | `sock.sendMessage(jid, { document: buffer, fileName, mimetype })` |
| QR code auth | `makeWASocket({ printQRInTerminal: false })` |
| Pairing code auth | `sock.requestPairingCode(phone)` |
| Connection management | `connection.update` event handler |
| Auth persistence | MongoDB-backed auth state |

**Per-Branch Instances:**
```
WhatsAppManager
  ├── defaultInstance (legacy, no branch auth)
  └── Map<branchId, WhatsAppService>
        ├── "branch_objid_1": WhatsAppService
        │     ├── authCollection: "baileys_auth_branch_objid_1"
        │     ├── messageQueue: QueueItem[]
        │     └── sock: WASocket
        └── "branch_objid_2": WhatsAppService
              └── ...
```

### 5.4 WhatsApp Message Flow

```
Business Event → WhatsApp Service → Baileys Socket → WhatsApp Servers
                    ↓
              Message Queue (if offline)
                    ↓
              Drain on Reconnect
```

### 5.5 External API Rate Limits

| Service | Rate Limit | Implementation |
|---------|------------|----------------|
| Express API | 1000 req/min per user / per IP (anonymous) | `express-rate-limit` |
| WhatsApp Broadcast | Anti-ban throttling | `delayMin: 2000ms`, `delayMax: 5000ms`, `batchSize: 20`, `pause: 15000ms + jitter` |

---

## 6. Internal Module Dependency Graph

### 6.1 Server Module Dependencies

```
server/src/index.ts
  ├── config.ts (PORT, MONGO_URI, JWT_SECRET, REDIS_URL, NODE_ENV)
  ├── app.ts (Express application)
  │   ├── routes/index.ts (route mounting)
  │   │   ├── routes/auth.ts
  │   │   │   ├── controllers/authController.ts
  │   │   │   │   ├── models/user.ts
  │   │   │   │   ├── models/branch.ts
  │   │   │   │   ├── utils/jwt.ts → config.ts
  │   │   │   │   └── middleware/errorHandler.ts (AppError)
  │   │   │   └── middleware/auth.ts → utils/jwt.ts
  │   │   ├── routes/customers.ts
  │   │   │   ├── controllers/customerController.ts
  │   │   │   │   ├── models/customer.ts → utils/branchProxy.ts
  │   │   │   │   ├── models/visit.ts
  │   │   │   │   ├── models/order.ts
  │   │   │   │   ├── models/bill.ts
  │   │   │   │   ├── models/prescription.ts
  │   │   │   │   ├── models/payment.ts
  │   │   │   │   ├── models/delivery.ts
  │   │   │   │   └── utils/response.ts
  │   │   │   ├── middleware/auth.ts
  │   │   │   └── middleware/cache.ts → services/cache.ts
  │   │   ├── routes/visits.ts
  │   │   │   ├── models/visit.ts
  │   │   │   ├── models/customer.ts
  │   │   │   └── middleware/* (auth, cache, asyncHandler, errorHandler)
  │   │   ├── routes/prescriptions.ts
  │   │   │   ├── models/prescription.ts
  │   │   │   ├── models/customer.ts
  │   │   │   ├── models/visit.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/orders.ts
  │   │   │   ├── models/order.ts, bill.ts, delivery.ts, payment.ts,
  │   │   │   │   customer.ts, settings.ts, prescription.ts
  │   │   │   ├── services/whatsapp.ts
  │   │   │   │   ├── @whiskeysockets/baileys
  │   │   │   │   ├── qrcode
  │   │   │   │   ├── mongoose (auth state storage)
  │   │   │   │   └── utils/phone.ts
  │   │   │   ├── utils/pdf.ts (PDFKit)
  │   │   │   └── middleware/* (auth, audit, cache, asyncHandler, errorHandler)
  │   │   ├── routes/bills.ts
  │   │   │   ├── models/bill.ts, customer.ts, settings.ts
  │   │   │   ├── services/whatsapp.ts
  │   │   │   ├── utils/pdf.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/payments.ts
  │   │   │   ├── models/payment.ts, bill.ts, customer.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/inventory.ts
  │   │   │   ├── models/inventory.ts
  │   │   │   ├── qrcode
  │   │   │   └── middleware/*
  │   │   ├── routes/delivery.ts
  │   │   │   ├── models/delivery.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/workspace.ts
  │   │   │   ├── models/* (all 7 models)
  │   │   │   └── middleware/*
  │   │   ├── routes/dashboard.ts
  │   │   │   ├── models/* (all models)
  │   │   │   └── middleware/*
  │   │   ├── routes/whatsapp.ts
  │   │   │   ├── services/whatsapp.ts
  │   │   │   └── middleware/* (auth, branch)
  │   │   ├── routes/branches.ts
  │   │   │   ├── models/branch.ts
  │   │   │   └── models/db.ts → clearBranchCache()
  │   │   ├── routes/settings.ts
  │   │   │   ├── models/settings.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/reports.ts
  │   │   │   ├── models/bill.ts, payment.ts, customer.ts, inventory.ts, delivery.ts
  │   │   │   └── middleware/*
  │   │   ├── routes/cache-admin.ts
  │   │   │   └── services/cache.ts
  │   │   ├── routes/recalculate.ts
  │   │   │   └── scripts/recalculate-customers.ts
  │   │   └── routes/todos.ts
  │   │       ├── models/todo.ts
  │   │       └── controllers/todoController.ts
  │   ├── middleware/audit.ts
  │   ├── middleware/errorHandler.ts
  │   └── middleware/branch.ts → models/branch.ts, models/db.ts, utils/requestContext.ts
  ├── services/cache.ts → ioredis → config.ts
  ├── services/whatsapp.ts → @whiskeysockets/baileys, qrcode, mongoose
  ├── models/db.ts → models/* (all schema imports)
  └── middleware/branch.ts → models/db.ts → models/branch.ts
```

### 6.2 Client Module Dependencies

```
client/src/main.tsx
  └── App.tsx
        ├── context/AppProviders.tsx
        │   ├── context/AuthContext.tsx → api.ts
        │   ├── context/ToastContext.tsx
        │   ├── context/ThemeContext.tsx
        │   └── context/TranslateContext.tsx
        ├── components/Layout.tsx → context/AuthContext.tsx, react-router-dom
        ├── components/errors/ErrorBoundary.tsx
        ├── components/RoleGuard.tsx → context/AuthContext.tsx
        └── pages/* (all lazy-loaded)
              ├── Dashboard.tsx → api.ts, recharts, DashboardCharts.tsx
              ├── Customers.tsx → api.ts, hooks/useDebounce.ts, hooks/useCache.ts
              ├── CustomerDetail.tsx → api.ts
              ├── CustomerNewVisit/* → api.ts
              ├── NewVisit.tsx → api.ts, components/NewvistePage/*
              ├── Orders.tsx → api.ts
              ├── Bills.tsx → api.ts
              ├── Payments.tsx → api.ts
              ├── InventoryPage.tsx → api.ts
              ├── Delivery.tsx → api.ts
              ├── Pickup.tsx → api.ts
              ├── ItemScan.tsx → html5-qrcode, jsqr
              ├── Reports.tsx → api.ts, recharts
              ├── Settings.tsx → api.ts
              ├── WhatsApp.tsx → api.ts
              ├── Workspace.tsx → api.ts
              ├── Announcement.tsx → api.ts
              ├── Login.tsx → context/AuthContext.tsx
              ├── StaffLogin.tsx → context/AuthContext.tsx
              └── Register.tsx → context/AuthContext.tsx

api.ts → fetch (native browser API)
hooks/useApi.ts → api.ts
hooks/useCache.ts → api.ts
hooks/useDebounce.ts
utils/pdf.ts → jspdf, jspdf-autotable
utils/rx.ts → prescription formatting utilities
utils/date.ts → date formatting utilities
```

### 6.3 Warehouse Module Dependencies

```
warehouse/src/main.tsx
  └── App.tsx
        ├── context/AuthContext.tsx → api.ts
        ├── context/ToastContext.tsx
        ├── context/ThemeContext.tsx
        ├── components/Layout.tsx
        ├── components/ProtectedRoute.tsx → context/AuthContext.tsx
        └── pages/*
              ├── Login.tsx → context/AuthContext.tsx
              ├── Register.tsx → api.ts
              ├── Dashboard.tsx → api.ts
              ├── Inventory.tsx → api.ts
              └── Users.tsx → api.ts

api.ts → fetch (native browser API)
hooks/useApi.ts → api.ts
types/inventory.ts → TypeScript interfaces
constants.ts → API URLs, configuration
```

---

## 7. Environment Variables

### 7.1 Server Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | Server listen port |
| `MONGO_URI` | Yes | `""` | MongoDB connection string |
| `JWT_SECRET` | Yes (prod) | `""` (dev warns) | JWT signing secret |
| `JWT_ACCESS_EXPIRY` | No | `7d` | Access token expiration |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiration |
| `REDIS_URL` | No | `""` | Redis connection string (optional; enables Redis-backed rate limits) |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGINS` | No | `""` | Comma-separated allowed origins (empty = reflect request origin) |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Global rate limit window |
| `RATE_LIMIT_MAX` | No | `1000` | Global rate limit max requests per window |
| `AUTH_RATE_LIMIT_MAX` | No | `30` | Auth endpoint rate limit max per window per IP |
| `LOG_LEVEL` | No | `info` | Pino log level (debug/info/warn/error) |
| `ENABLE_CLUSTER` | No | `false` | Run server across all CPUs (cluster mode) |
| `CLUSTER_WORKERS` | No | `0` | Cluster worker count (`0` = auto = CPU count) |
| `WAREHOUSE_DB_NAME` | No | `kmj_warehouse` | Warehouse MongoDB database name |
| `TZ` | No | `Asia/Kolkata` | Application timezone |

### 7.2 Client Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:4000/api` | Backend API base URL |

### 7.3 Warehouse Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:4000` | Backend API base URL |

---

## 8. Shared Dependencies Across Projects

### 8.1 Common Package Versions

| Package | Server | Client | Warehouse | Notes |
|---------|--------|--------|-----------|-------|
| react | N/A | 18.2.0 | 18.2.0 | Pinned, not caret |
| react-dom | N/A | 18.2.0 | 18.2.0 | Pinned, not caret |
| react-router-dom | N/A | 6.14.1 | 6.14.1 | Same version |
| lucide-react | N/A | ^1.21.0 | ^1.21.0 | Same version |
| tailwindcss | N/A | ^3.3.5 | ^3.3.5 | Same version |
| typescript | 5.2.2 | ^5.2.2 | ^5.2.2 | Server pinned exactly |
| vite | N/A | ^4.5.0 | ^4.5.0 | Same version |
| qrcode | ^1.5.4 | ^1.5.4 | N/A | Server + Client |

### 8.2 Dependency Overlap Analysis

**Server-only packages** (not used by client/warehouse):
- `bcrypt`, `compression`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `ioredis`, `jsonwebtoken`, `mongoose`, `pdfkit`, `pino`, `pino-http`, `rate-limit-redis`, `zod`

**Client-only packages** (not used by server/warehouse):
- `framer-motion`, `html5-qrcode`, `jspdf`, `jspdf-autotable`, `jsqr`, `recharts`

**Shared packages** (used by both client and warehouse):
- `react`, `react-dom`, `react-router-dom`, `lucide-react`

**Shared packages** (used by server and client):
- `qrcode` (for QR generation)

---

## 9. Build & Development Dependencies

### 9.1 Build Tools

| Tool | Used By | Purpose |
|------|---------|---------|
| Vite 4.5 | client, warehouse | Fast dev server + production build |
| TypeScript 5.2.2 | All three | Type checking and compilation |
| ts-node-dev | server | Development with auto-reload |
| PostCSS | client, warehouse | CSS processing |
| Autoprefixer | client, warehouse | CSS vendor prefixing |
| Tailwind CSS | client, warehouse | Utility CSS framework |

### 9.2 Deployment

| Tool | Purpose |
|------|---------|
| `render.yaml` | Render.com deployment configuration |
| `app.patch` | Application patch file |
| `.nvmrc` | Node.js version specification |

---

## AI Instructions for Using This Knowledge

When modifying dependencies:

1. **Version pinning matters**: React, React DOM are pinned to exact versions (18.2.0) — do not change without testing all three projects.

2. **Server packages are critical**: `mongoose`, `@whiskeysockets/baileys`, `express` are production dependencies. Changes require thorough testing.

3. **Redis is optional**: If `REDIS_URL` is not set, the system runs without caching. All cache operations gracefully degrade.

4. **WhatsApp auth is per-branch**: Each branch gets its own Baileys auth collection in MongoDB. Clearing one branch's auth does not affect others.

5. **MongoDB connection pooling**: Pool size is 10 — sufficient for the current load. Monitor if scaling to many concurrent branches.

6. **Client and warehouse share**: React version, react-router-dom version, and Tailwind CSS version. Keep them in sync.

7. **TypeScript 5.2.2 is pinned in server**: This avoids breaking changes from TypeScript updates. Client/warehouse use caret ranges.

8. **PDF generation is server-side only**: `pdfkit` on server for bill/demand PDFs. `jspdf` on client for client-side PDF generation (different library).
