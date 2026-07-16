# KMJ Optical ERP — Feature Map

> Complete feature catalog with file mappings, API endpoints, database models, UI pages, dependencies, and status.

---

## Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Customer Management](#2-customer-management)
3. [Visit Management](#3-visit-management)
4. [Prescription Management](#4-prescription-management)
5. [Order Management](#5-order-management)
6. [Billing Management](#6-billing-management)
7. [Payment Management](#7-payment-management)
8. [Inventory Management](#8-inventory-management)
9. [Delivery Management](#9-delivery-management)
10. [WhatsApp Integration](#10-whatsapp-integration)
11. [Multi-Branch Management](#11-multi-branch-management)
12. [Dashboard & Analytics](#12-dashboard--analytics)
13. [Reports](#13-reports)
14. [Workspace (Unified Transaction)](#14-workspace-unified-transaction)
15. [Settings & Configuration](#15-settings--configuration)
16. [Todo / Task Management](#16-todo--task-management)
17. [Warehouse Management](#17-warehouse-management)
18. [Caching & Performance](#18-caching--performance)
19. [Cross-Cutting Features](#19-cross-cutting-features)

---

## Status Legend

| Status | Description |
|--------|-------------|
| ✅ Stable | Fully implemented, tested, in production use |
| 🔧 Beta | Implemented but may have rough edges |
| 🚧 WIP | Work in progress, partially implemented |
| 📋 Planned | Designed but not yet implemented |
| ⚠️ Deprecated | Exists but should not be used for new code |

---

## 1. Authentication & User Management

### 1.1 Admin Login

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Login.tsx` |
| API Endpoint | `POST /api/auth/login` |
| Backend Files | `server/src/controllers/authController.ts:94-117`, `server/src/routes/auth.ts:9` |
| Database Model | `User` (`server/src/models/user.ts`) |
| Dependencies | JWT, bcrypt |
| Notes | Rejects staff role — staff must use staff-login |

### 1.2 Staff Login

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/StaffLogin.tsx` |
| API Endpoint | `POST /api/auth/staff-login` |
| Backend Files | `server/src/controllers/authController.ts:119-148`, `server/src/routes/auth.ts:10` |
| Database Model | `User` |
| Dependencies | JWT, bcrypt |
| Notes | Auto-detects branch from user's assigned branches |

### 1.3 Warehouse Login

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `warehouse/src/pages/Login.tsx` |
| API Endpoint | `POST /api/auth/warehouse-login` |
| Backend Files | `server/src/controllers/authController.ts:53-73`, `server/src/routes/auth.ts:11` |
| Database Model | `User` |
| Notes | Restricted to warehouse/owner roles |

### 1.4 User Registration (Admin)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Register.tsx` |
| API Endpoint | `POST /api/auth/register` |
| Backend Files | `server/src/controllers/authController.ts:30-51`, `server/src/routes/auth.ts:8` |
| Database Model | `User` |
| Dependencies | Auth middleware (requires owner role) |
| Notes | Only owner can create new users |

### 1.5 Warehouse User Registration

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `warehouse/src/pages/Register.tsx` |
| API Endpoint | `POST /api/auth/warehouse-register` |
| Backend Files | `server/src/controllers/authController.ts:75-92`, `server/src/routes/auth.ts:12` |
| Database Model | `User` |
| Notes | Owner or warehouse users can create warehouse accounts |

### 1.6 Token Refresh

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/auth/refresh` |
| Backend Files | `server/src/controllers/authController.ts:150-162`, `server/src/routes/auth.ts:13` |
| Database Model | `User` |
| Notes | Exchange refresh token for new access token |

### 1.7 Profile Management (Me)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/auth/me`, `PUT /api/auth/me` |
| Backend Files | `server/src/controllers/authController.ts:164-187`, `server/src/routes/auth.ts:14-15` |
| Database Model | `User` |
| Notes | Update name, mobile, password |

### 1.8 User List & Management

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `warehouse/src/pages/Users.tsx` |
| API Endpoints | `GET /api/auth/users`, `GET /api/auth/warehouse-users`, `PUT /api/auth/users/:id`, `DELETE /api/auth/users/:id` |
| Backend Files | `server/src/controllers/authController.ts:189-241`, `server/src/routes/auth.ts:16-19` |
| Database Model | `User` |
| Notes | Owner-only; warehouse users manage warehouse accounts |

### 1.9 Client-Side Auth Context

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/context/AuthContext.tsx` |
| Dependencies | React Context, localStorage |
| Notes | Stores user, tokens, selected branch in context + localStorage |

### 1.10 Role Guard (Frontend)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/components/RoleGuard.tsx` |
| Notes | Wraps routes requiring specific roles; redirects unauthorized |

---

## 2. Customer Management

### 2.1 Customer List (with Search & Pagination)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Customers.tsx` |
| API Endpoint | `GET /api/customers?search=&phone=&page=&limit=` |
| Backend Files | `server/src/controllers/customerController.ts:16-38`, `server/src/routes/customers.ts:9` |
| Database Model | `Customer` (`server/src/models/customer.ts`) |
| Cache | 60s TTL |
| Dependencies | Redis cache |
| Notes | Regex search across 6 fields; paginated response |

### 2.2 Customer Detail

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/CustomerDetail.tsx` |
| API Endpoints | `GET /api/customers/:id`, `GET /api/customers/summary/:id` |
| Backend Files | `server/src/controllers/customerController.ts:40-44,75-92`, `server/src/routes/customers.ts:15-16` |
| Database Model | `Customer`, aggregates Visit count, Order count, Bill totals |

### 2.3 Customer Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Pages | `client/src/pages/Customers.tsx` (inline), Workspace |
| API Endpoint | `POST /api/customers` |
| Backend Files | `server/src/controllers/customerController.ts:46-52`, `server/src/routes/customers.ts:10-14` |
| Database Model | `Customer` |
| Cache Invalidation | `/api/customers`, `/api/dashboard` |
| Notes | Requires name + mobile |

### 2.4 Customer Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Pages | `client/src/pages/CustomerDetail.tsx` |
| API Endpoint | `PUT /api/customers/:id` |
| Backend Files | `server/src/controllers/customerController.ts:54-58`, `server/src/routes/customers.ts:17-21` |
| Cache Invalidation | `/api/customers`, `/api/dashboard` |

### 2.5 Customer Deletion (Cascade)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Pages | `client/src/pages/CustomerDetail.tsx` |
| API Endpoint | `DELETE /api/customers/:id` |
| Backend Files | `server/src/controllers/customerController.ts:60-73`, `server/src/routes/customers.ts:22-26` |
| Notes | Cascading delete: Visit, Order, Bill, Prescription, Payment, Delivery |

---

## 3. Visit Management

### 3.1 Visit List

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/visits?customerId=` |
| Backend Files | `server/src/routes/visits.ts:20-26` |
| Database Model | `Visit` (`server/src/models/visit.ts`) |
| Cache | 30s TTL |
| Notes | Filtered by customerId; max 200 results |

### 3.2 Visit Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/visits` |
| Backend Files | `server/src/routes/visits.ts:28-39` |
| Database Model | `Visit` |
| Side Effects | Increments Customer.totalVisits |
| Cache Invalidation | `/api/visits` |
| Notes | Validates customer exists; Zod schema validation |

### 3.3 Visit Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/visits/:id` |
| Backend Files | `server/src/routes/visits.ts:47-52` |
| Cache Invalidation | `/api/visits` |

### 3.4 Visit Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/visits/:id` |
| Backend Files | `server/src/routes/visits.ts:54-60` |
| Side Effects | Decrements Customer.totalVisits |

### 3.5 New Visit Page (Full Flow)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Pages | `client/src/pages/NewVisit.tsx`, `client/src/pages/CustomerNewVisit/` |
| Frontend Components | `client/src/components/NewvistePage/` — VisitStepper, VisitTypeSection, PrescriptionPanel, OrderItems, BillingPanel, PaymentPanel, ConfirmationDashboard, BottomNav, PageHeader |
| Notes | Multi-step wizard: Visit → Prescription → Order → Bill → Payment → Confirm |

---

## 4. Prescription Management

### 4.1 Prescription List

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/prescriptions?customerId=` |
| Backend Files | `server/src/routes/prescriptions.ts:29-35` |
| Database Model | `Prescription` (`server/src/models/prescription.ts`) |
| Cache | 30s TTL |

### 4.2 Prescription Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/prescriptions` |
| Backend Files | `server/src/routes/prescriptions.ts:37-47` |
| Database Model | `Prescription` |
| Notes | Validates customer and optional visit exist |

### 4.3 Prescription Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/prescriptions/:id` |
| Backend Files | `server/src/routes/prescriptions.ts:55-60` |

### 4.4 Prescription Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/prescriptions/:id` |
| Backend Files | `server/src/routes/prescriptions.ts:62-66` |

### 4.5 Prescription Panel (UI)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/components/NewvistePage/PrescriptionPanel.tsx` |
| Notes | Eye fields: DV, NV, PC per eye with SPH/CYL/axis/VA inputs |

---

## 5. Order Management

### 5.1 Order List (with Filters)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Orders.tsx` |
| API Endpoint | `GET /api/orders?customerId=&startDate=&endDate=&status=&dateField=` |
| Backend Files | `server/src/routes/orders.ts:66-102` |
| Database Model | `Order` (`server/src/models/order.ts`) |
| Cache | 30s TTL |
| Notes | Returns enriched data with billInfo per order |

### 5.2 Order Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/orders` |
| Backend Files | `server/src/routes/orders.ts:104-113` |
| Database Model | `Order` |
| Middleware | `audit` (logs creation) |
| Cache Invalidation | `/api/orders`, `/api/dashboard` |

### 5.3 Order Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/orders/:id` |
| Backend Files | `server/src/routes/orders.ts:121-128` |
| Middleware | `audit` |

### 5.4 Order Status Update (State Machine)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PATCH /api/orders/:id/status` |
| Backend Files | `server/src/routes/orders.ts:170-278` |
| Notes | Validates transitions; supports partial quantity advancement; auto-updates delivery; auto-sends WhatsApp; optional payment collection on delivery |

### 5.5 Order Classification

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PATCH /api/orders/:id/classify` |
| Backend Files | `server/src/routes/orders.ts:131-141` |
| Notes | Sets overall classification: pending/stock/buy/order |

### 5.6 Per-Eye Classification

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PATCH /api/orders/:id/classify-eye` |
| Backend Files | `server/src/routes/orders.ts:144-154` |
| Notes | Sets rightLensStatus or leftLensStatus |

### 5.7 Order Review Toggle

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PATCH /api/orders/:id/review` |
| Backend Files | `server/src/routes/orders.ts:157-167` |

### 5.8 Order Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/orders/:id` |
| Backend Files | `server/src/routes/orders.ts:396-402` |
| Middleware | `audit` |

### 5.9 Demand List Generation & Send

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/orders/demand-send` |
| Backend Files | `server/src/routes/orders.ts:405-585` |
| Notes | Generates PDF demand list (buy/order), sends via WhatsApp to shop owner; falls back to text if media fails |

### 5.10 Demand PDF Generation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/routes/orders.ts:297-394` |
| Notes | PDFKit-based; styled table with per-eye entries, prescriptions, lens info |

---

## 6. Billing Management

### 6.1 Bill List (with Filters)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Bills.tsx` |
| API Endpoint | `GET /api/bills?customerId=&startDate=&endDate=` |
| Backend Files | `server/src/routes/bills.ts:25-48` |
| Database Model | `Bill` (`server/src/models/bill.ts`) |
| Cache | 30s TTL |

### 6.2 Bill Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/bills` |
| Backend Files | `server/src/routes/bills.ts:50-103` |
| Database Model | `Bill` |
| Side Effects | Updates Customer.totalSpent + pendingAmount; WhatsApp PDF notification (async) |
| Middleware | `audit` |
| Cache Invalidation | `/api/bills`, `/api/dashboard` |

### 6.3 Bill Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/bills/:id` |
| Backend Files | `server/src/routes/bills.ts:111-150` |
| Notes | Delta-adjusts Customer.totalSpent/pendingAmount |

### 6.4 Bill Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/bills/:id` |
| Backend Files | `server/src/routes/bills.ts:152-163` |
| Notes | Reverses Customer.totalSpent and pendingAmount |

### 6.5 Bill PDF Generation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/pdf.ts:40-212` |
| Notes | PDFKit-based A4 PDF with shop branding, line items, totals |

### 6.6 Bill Detail

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/bills/:id` |
| Backend Files | `server/src/routes/bills.ts:105-109` |

---

## 7. Payment Management

### 7.1 Payment List (with Filters)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Payments.tsx` |
| API Endpoint | `GET /api/payments?startDate=&endDate=&customerId=&billId=` |
| Backend Files | `server/src/routes/payments.ts:16-40` |
| Database Model | `Payment` (`server/src/models/payment.ts`) |
| Cache | 30s TTL |

### 7.2 Payment Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/payments` |
| Backend Files | `server/src/routes/payments.ts:42-66` |
| Side Effects | Updates Bill.advancePaid + pendingAmount; updates Customer.pendingAmount |
| Middleware | `audit` |
| Cache Invalidation | `/api/payments`, `/api/bills`, `/api/dashboard` |

### 7.3 Payment Update (with Delta Tracking)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/payments/:id` |
| Backend Files | `server/src/routes/payments.ts:68-104` |
| Notes | Tracks amount changes; adjusts Bill and Customer by delta |

### 7.4 Payment Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/payments/:id` |
| Backend Files | `server/src/routes/payments.ts:106-129` |
| Notes | Reverses Bill.advancePaid and Customer.pendingAmount |

---

## 8. Inventory Management

### 8.1 Inventory List (with Search)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/InventoryPage.tsx` |
| API Endpoint | `GET /api/inventory?q=` |
| Backend Files | `server/src/routes/inventory.ts:56-71` |
| Database Model | `Inventory` (`server/src/models/inventory.ts`) |
| Cache | 60s TTL |

### 8.2 Inventory Stats

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/inventory/stats` |
| Backend Files | `server/src/routes/inventory.ts:34-54` |
| Notes | Returns totalItems, lowStock, warehouseItems, totalValue, recentItems |

### 8.3 Inventory Item Detail

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/inventory/:id` |
| Backend Files | `server/src/routes/inventory.ts:73-77` |

### 8.4 Inventory Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/inventory` |
| Backend Files | `server/src/routes/inventory.ts:96-101` |
| Middleware | `audit` |

### 8.5 Stock Adjustment

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/inventory/:id/stock` |
| Backend Files | `server/src/routes/inventory.ts:103-113` |
| Notes | Atomic `$inc` on quantity; supports positive/negative adjustments |

### 8.6 Inventory Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/inventory/:id` |
| Backend Files | `server/src/routes/inventory.ts:115-125` |
| Notes | Whitelisted fields only |

### 8.7 Inventory Deletion

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/inventory/:id` |
| Backend Files | `server/src/routes/inventory.ts:127-132` |
| Middleware | `audit` |

### 8.8 QR Code Lookup

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/inventory/qr/:code` |
| Backend Files | `server/src/routes/inventory.ts:79-83` |
| Notes | Finds item by SKU code |

### 8.9 QR Code Image Generation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/inventory/:id/qr-image` |
| Backend Files | `server/src/routes/inventory.ts:85-94` |
| Notes | Returns PNG QR code image |

### 8.10 Item Scan Page

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/ItemScan.tsx` |
| Frontend Files | `client/src/components/CameraScanner.tsx` |
| Notes | Camera-based QR/barcode scanner; navigates to inventory item |

---

## 9. Delivery Management

### 9.1 Delivery List

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Delivery.tsx` |
| API Endpoint | `GET /api/delivery?status=` |
| Backend Files | `server/src/routes/delivery.ts:10-21` |
| Database Model | `Delivery` (`server/src/models/delivery.ts`) |
| Cache | 30s TTL |
| Notes | Populates customer name/mobile and order frame/lens/status |

### 9.2 Delivery Detail

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/delivery/:id` |
| Backend Files | `server/src/routes/delivery.ts:23-30` |

### 9.3 Pickup Page

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Pickup.tsx` |
| Notes | Customer-facing page for order pickup; search by name/mobile |

---

## 10. WhatsApp Integration

### 10.1 WhatsApp Status Check

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/whatsapp/status` |
| Backend Files | `server/src/routes/whatsapp.ts:10-14` |

### 10.2 QR Code Display

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/whatsapp/qr` |
| Backend Files | `server/src/routes/whatsapp.ts:16-20` |

### 10.3 Send Text Message

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/whatsapp/send` |
| Backend Files | `server/src/routes/whatsapp.ts:27-39` |

### 10.4 Send Media (PDF/Image)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/whatsapp/send-media` |
| Backend Files | `server/src/routes/whatsapp.ts:41-54` |

### 10.5 Broadcast Messages

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/whatsapp/broadcast` |
| Backend Files | `server/src/routes/whatsapp.ts:78-89`, `server/src/services/whatsapp.ts:425-474` |
| Notes | Anti-ban throttling; configurable delay, batch size, pause |

### 10.6 Broadcast Abort

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/whatsapp/broadcast/abort` |
| Backend Files | `server/src/routes/whatsapp.ts:91-95` |

### 10.7 WhatsApp Disconnect & Reconnect

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoints | `POST /api/whatsapp/disconnect`, `POST /api/whatsapp/pair`, `POST /api/whatsapp/init` |
| Backend Files | `server/src/routes/whatsapp.ts:56-76` |

### 10.8 WhatsApp Queue Monitor

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/whatsapp/queue` |
| Backend Files | `server/src/routes/whatsapp.ts:22-25` |

### 10.9 WhatsApp Settings Page

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/WhatsApp.tsx` |
| Notes | QR display, connection status, manual send, broadcast |

---

## 11. Multi-Branch Management

### 11.1 Branch List

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoints | `GET /api/branches`, `GET /api/branches/active` |
| Backend Files | `server/src/routes/branches.ts:10-18` |
| Database Model | `Branch` (`server/src/models/branch.ts`) |

### 11.2 Branch Creation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/branches` |
| Backend Files | `server/src/routes/branches.ts:26-52` |
| Notes | Clears branch model cache |

### 11.3 Branch Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/branches/:id` |
| Backend Files | `server/src/routes/branches.ts:56-69` |

### 11.4 Branch Deactivation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `DELETE /api/branches/:id` |
| Backend Files | `server/src/routes/branches.ts:71-80` |
| Notes | Soft delete: sets isActive=false |

### 11.5 Branch Scope Middleware

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/middleware/branch.ts` |
| Notes | Intercepts X-Branch-ID header; loads branch-scoped models |

### 11.6 Branch Proxy (Transparent Model Switching)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/branchProxy.ts` |
| Notes | Proxy-based transparent branch-scoped model access |

### 11.7 Branch Database Manager

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/models/db.ts` |
| Notes | Connection caching per branch database |

---

## 12. Dashboard & Analytics

### 12.1 Main Dashboard

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Dashboard.tsx` |
| API Endpoint | `GET /api/dashboard/stats` |
| Backend Files | `server/src/routes/dashboard.ts:41-237` |
| Cache | 30s TTL |
| Notes | Massive aggregation: 20+ parallel MongoDB queries; sales, collections, orders, bills, payments, deliveries, inventory, trends |

### 12.2 Dashboard Charts

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/components/DashboardCharts.tsx` |
| Dependencies | Recharts |
| Notes | Daily sales chart, payment mode pie, order status bar |

### 12.3 Dashboard Data Points

| Data | Description | Source |
|------|-------------|--------|
| counts | Total customers, orders, bills, payments, inventory, deliveries, visits | countDocuments |
| todaySales | Today's bill totalAmount sum | Bill.aggregate |
| todayCollection | Today's payment amount sum | Payment.aggregate |
| weekSales | This week's bill total | Bill.aggregate |
| monthSales | This month's bill total | Bill.aggregate |
| readyDeliveries | Deliveries with status "Ready" | Delivery.countDocuments |
| newCustomersToday | New customers created today | Customer.countDocuments |
| lowStock | Items with quantity <= 5 | Inventory.countDocuments |
| pendingPayments | Total pending bill amounts | Payment.aggregate + $lookup |
| recentCustomers | 5 most recent customers | Customer.find |
| recentOrders | 5 most recent orders | Order.find |
| todayDeliveries | Today's + pending/ready deliveries | Delivery.find |
| pendingBills | Top 5 bills by pending amount | Bill.find |
| incompleteOrders | Orders in Draft/Ordered/In Lab with stock status | Order.find + Inventory cross-reference |
| dailySales | 30-day daily sales data | Bill.aggregate |
| paymentModeSplit | Today's payment mode breakdown | Payment.aggregate |
| orderStatusCounts | All orders grouped by status | Order.aggregate |
| salesTrend | % change vs same day last week | Calculated |
| todayDeliveredOrders | Orders delivered today | Order.find |

---

## 13. Reports

### 13.1 Revenue Report

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Reports.tsx` |
| API Endpoint | `GET /api/reports/revenue?start=&end=` |
| Backend Files | `server/src/routes/reports.ts:13-49` |
| Cache | 60s TTL |

### 13.2 Monthly Report

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/reports/monthly` |
| Backend Files | `server/src/routes/reports.ts:51-65` |
| Cache | 120s TTL |

### 13.3 Customer Report

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/reports/customers?start=&end=&city=&tag=&type=` |
| Backend Files | `server/src/routes/reports.ts:67-97` |
| Cache | 120s TTL |

### 13.4 Inventory Report

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/reports/inventory?category=` |
| Backend Files | `server/src/routes/reports.ts:99-116` |
| Cache | 60s TTL |

### 13.5 Delivery Report

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `GET /api/reports/deliveries` |
| Backend Files | `server/src/routes/reports.ts:118-131` |
| Cache | 30s TTL |

---

## 14. Workspace (Unified Transaction)

### 14.1 Atomic Transaction

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Workspace.tsx` |
| API Endpoint | `POST /api/workspace/transaction` |
| Backend Files | `server/src/routes/workspace.ts:56-180` |
| Database Models | Customer, Visit, Prescription, Order, Bill, Payment, Delivery (all in one call) |
| Notes | Creates all entities in a single API call; NOT wrapped in MongoDB transaction |

### 14.2 Workspace Flow

```
1. Customer lookup/create
2. Visit creation (if provided)
3. Prescription creation (if provided, linked to visit)
4. Order creation (if provided, linked to visit)
5. Bill creation (if provided, with items/total)
6. Payment creation (if amount > 0, linked to bill)
7. Delivery creation (if provided, linked to order)
8. Cache invalidation for all domains
```

---

## 15. Settings & Configuration

### 15.1 Settings Get

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Settings.tsx` |
| API Endpoint | `GET /api/settings` |
| Backend Files | `server/src/routes/settings.ts:8-14` |
| Database Model | `Settings` (`server/src/models/settings.ts`) |
| Notes | Creates default settings if none exist |

### 15.2 Settings Update

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `PUT /api/settings` |
| Backend Files | `server/src/routes/settings.ts:22-33` |
| Notes | Whitelisted fields; upsert behavior |

### 15.3 Settings Fields

| Field | Purpose |
|-------|---------|
| shopName | Displayed on PDFs, WhatsApp messages |
| shopAddress | Bill PDF header |
| shopPhone | Used as WhatsApp recipient for demand lists |
| shopEmail | Bill PDF header |
| adminWhatsApp | Admin WhatsApp number |
| logo | Shop logo for PDFs (base64 or URL) |

### 15.4 Settings Frontend

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/pages/Settings.tsx`, `client/src/pages/settings/` — ThemeToggle, SettingsHeader, SectionNav, SectionCard, FormField |

---

## 16. Todo / Task Management

### 16.1 Todo CRUD

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoints | `GET /api/todos`, `POST /api/todos`, `PUT /api/todos/:id`, `DELETE /api/todos/:id` |
| Backend Files | `server/src/controllers/todoController.ts`, `server/src/routes/todos.ts` |
| Database Model | `Todo` (`server/src/models/todo.ts`) |

---

## 17. Warehouse Management

### 17.1 Warehouse App (Separate SPA)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Entry | `warehouse/src/main.tsx` |
| Pages | Login, Register, Dashboard, Inventory, Users |
| API | Same backend server, separate auth flow |

### 17.2 Warehouse Dashboard

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Page | `warehouse/src/pages/Dashboard.tsx` |
| Notes | Inventory summary, recent items |

### 17.3 Warehouse Inventory

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Page | `warehouse/src/pages/Inventory.tsx` |
| Notes | Full CRUD for inventory items; stock adjustments |

### 17.4 Warehouse User Management

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Page | `warehouse/src/pages/Users.tsx` |
| Notes | Create/delete warehouse users |

### 17.5 Warehouse Withdraw Modal

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Component | `warehouse/src/components/WithdrawModal.tsx` |
| Notes | Stock withdrawal functionality |

---

## 18. Caching & Performance

### 18.1 Redis Route Caching

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/services/cache.ts`, `server/src/middleware/cache.ts` |
| Notes | Branch-aware caching with SCAN-based invalidation |

### 18.2 Cache Admin

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoints | `GET /api/cache/keys`, `DELETE /api/cache/flush`, `DELETE /api/cache/pattern` |
| Backend Files | `server/src/routes/cache-admin.ts` |

### 18.3 Cache TTLs

| Route | TTL |
|-------|-----|
| Dashboard | 30s |
| Customers | 60s |
| Inventory | 60s |
| Orders | 30s |
| Bills | 30s |
| Payments | 30s |
| Deliveries | 30s |
| Visits | 30s |
| Prescriptions | 30s |
| Settings | Default (60s) |
| Reports | 60-120s |

---

## 19. Cross-Cutting Features

### 19.1 Error Handling

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/middleware/errorHandler.ts` |
| Notes | AppError class; handles Validation, Cast, Duplicate, and generic errors |

### 19.2 Audit Logging

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/middleware/audit.ts` |
| Notes | Logs method, path, user, IP; applied to mutating endpoints |

### 19.3 Async Handler

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/middleware/asyncHandler.ts` |
| Notes | Wraps async route handlers to catch errors |

### 19.4 Rate Limiting

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/app.ts:30-37` |
| Notes | 200 requests/minute per IP |

### 19.5 CORS

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/app.ts:16-24` |
| Notes | Allows localhost:5173, localhost:4000, localhost:5174, production URL |

### 19.6 Helmet Security

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/app.ts:15` |
| Notes | CSP disabled for SPA compatibility |

### 19.7 Compression

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/app.ts:25` |
| Notes | gzip level 6, threshold 1024 bytes |

### 19.8 Morgan Logging

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/app.ts:27` |
| Notes | "dev" format; disabled in test |

### 19.9 PDF Utility

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/pdf.ts` |
| Notes | generateBillPdf, downloadBillPdf, openBillPdf |

### 19.10 Phone Utility

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/phone.ts` |
| Notes | normalizePhone (Indian format), toWhatsAppJID |

### 19.11 JWT Utility

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/jwt.ts` |
| Notes | signAccess, signRefresh, verifyToken |

### 19.12 Response Utility

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/response.ts` |
| Notes | success, created, notFound helpers |

### 19.13 Request Context

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/utils/requestContext.ts` |
| Notes | AsyncLocalStorage for branch-scoped request context |

### 19.14 Legacy Migration

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/migrations/migrate-legacy.ts` |

### 19.15 Customer Recalculation

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| API Endpoint | `POST /api/recalculate/customers` |
| Backend Files | `server/src/routes/recalculate.ts`, `server/src/scripts/recalculate-customers.ts` |
| Notes | Recalculates denormalized customer fields from actual data |

### 19.16 Branch Migration Script

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Backend Files | `server/src/scripts/migrate-branches.ts`, `server/src/scripts/fix-branch-migration.ts` |

### 19.17 Lazy Loading (Code Splitting)

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/App.tsx` |
| Notes | All page components use React.lazy() with Suspense fallbacks |

### 19.18 Error Boundary

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/components/errors/ErrorBoundary.tsx`, `client/src/components/errors/PageLoader.tsx` |

### 19.19 Toast Notifications

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/components/Toast.tsx`, `client/src/context/ToastContext.tsx` |

### 19.20 Theme Support

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| Frontend Files | `client/src/context/ThemeContext.tsx`, `client/src/pages/settings/ThemeToggle.tsx` |
| Warehouse | `warehouse/src/components/ThemeToggle.tsx`, `warehouse/src/context/ThemeContext.tsx` |

### 19.21 Announcements

| Attribute | Value |
|-----------|-------|
| Status | ✅ Stable |
| UI Page | `client/src/pages/Announcement.tsx` |
| Notes | Broadcast announcements to customers |

---

## Feature Dependency Graph

```
Authentication ──→ All Features (every route uses authenticate middleware)
Branch Scope ──→ All Branch-Scoped Routes (customers, orders, bills, etc.)
Customer ──→ Visit ──→ Prescription
           ──→ Order ──→ Delivery
           ──→ Bill ──→ Payment
Inventory ──→ Order (classification, demand list)
Settings ──→ Bill PDF, WhatsApp Messages
WhatsApp ──→ Bill Creation, Order Status Updates, Demand Lists
Dashboard ──→ All Domains (aggregates everything)
Reports ──→ Bill, Payment, Customer, Inventory, Delivery
Workspace ──→ Customer, Visit, Prescription, Order, Bill, Payment, Delivery
Cache ──→ All Read Endpoints
```

---

## AI Instructions for Using This Knowledge

When implementing new features or modifying existing ones:

1. **Check the dependency graph**: Before modifying a domain, understand what depends on it.

2. **Follow the file mapping pattern**: Each feature has backend files, API endpoints, frontend files, and database models. When adding a feature, create files in all four layers.

3. **Cache invalidation**: Any mutation must invalidate the relevant route cache AND `/api/dashboard`.

4. **Branch scoping**: All new routes under branch-scoped domains must be added to `routes/index.ts` with `branchScope` middleware.

5. **Status checks**: Use the status column to understand if a feature is stable or in progress. Do not rely on beta/WIP features without checking implementation.

6. **Audit logging**: Apply `audit` middleware to all mutating endpoints that should be tracked.

7. **Zod validation**: All request bodies should be validated with Zod schemas before processing.

8. **Role guards**: Check RoleGuard component on frontend for role-restricted pages.
