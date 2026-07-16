# KMJ Optical ERP — Data Flow Documentation

> Complete data flow documentation for every major workflow in the system,
> with sequence diagrams, business rules, edge cases, and implementation references.

---

## Table of Contents

1. [Customer Creation Flow](#1-customer-creation-flow)
2. [Visit Creation Flow](#2-visit-creation-flow)
3. [Prescription Creation Flow](#3-prescription-creation-flow)
4. [Order Creation Flow](#4-order-creation-flow)
5. [Bill Creation Flow](#5-bill-creation-flow)
6. [Payment Creation Flow](#6-payment-creation-flow)
7. [Inventory Update Flow](#7-inventory-update-flow)
8. [Delivery Tracking Flow](#8-delivery-tracking-flow)
9. [WhatsApp Notification Flow](#9-whatsapp-notification-flow)
10. [Dashboard Aggregation Flow](#10-dashboard-aggregation-flow)
11. [Workspace Transaction Flow](#11-workspace-transaction-flow)
12. [Order Status Transition Flow](#12-order-status-transition-flow)
13. [Demand List Generation Flow](#13-demand-list-generation-flow)
14. [Authentication Flow](#14-authentication-flow)
15. [Branch Scope Flow](#15-branch-scope-flow)
16. [Cache Invalidation Flow](#16-cache-invalidation-flow)

---

## Legend

```
Client        →  React frontend (client/)
Server        →  Express backend (server/)
MongoDB       →  Database
Redis         →  Cache (optional)
WhatsApp      →  Baileys service
WA Manager    →  WhatsAppManager singleton
```

---

## 1. Customer Creation Flow

### 1.1 Sequence Diagram

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/customers │                        │
  │ { name, mobile,     │                        │
  │   email, age, ... } │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     │   verify JWT           │
  │                     │                        │
  │                     ├── branchScope()        │
  │                     │   load branch models   │
  │                     │                        │
  │                     ├── validate input       │
  │                     │   name required        │
  │                     │   mobile required      │
  │                     │                        │
  │                     │                        │
  │                     │   Customer.create()    │
  │                     │───────────────────────>│
  │                     │                        │
  │                     │                        ├── Generate _id
  │                     │                        ├── Save document
  │                     │                        │
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── invalidateCache()    │
  │                     │   "/api/customers"     │
  │                     │   "/api/dashboard"     │
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
  │                     │                        │
```

### 1.2 Data Flow

```
Input Data:
  {
    name: "Rahul Sharma",
    mobile: "9876543210",
    email: "rahul@email.com",
    age: 28,
    gender: "Male",
    address: "123 Main St",
    city: "Delhi"
  }

Processing:
  1. Validate: name.trim() !== "" → OK
  2. Validate: mobile.trim() !== "" → OK
  3. mobile = mobile.trim() → "9876543210"
  4. Customer.create({ ...body, mobile })
     → MongoDB auto-generates _id
     → customerId NOT set by this endpoint
       (set by workspace transaction instead)

Output:
  {
    _id: ObjectId("..."),
    name: "Rahul Sharma",
    mobile: "9876543210",
    totalVisits: 0,
    totalSpent: 0,
    pendingAmount: 0,
    tags: [],
    createdAt: "2026-07-16T..."
  }

Side Effects:
  - Redis cache invalidated for /api/customers
  - Redis cache invalidated for /api/dashboard
```

### 1.3 Business Rules

| Rule | Code Reference |
|------|----------------|
| Name must be non-empty after trim | `customerController.ts:48` |
| Mobile must be non-empty after trim | `customerController.ts:49` |
| Mobile is trimmed before storage | `customerController.ts:50` |
| Denormalized fields start at 0 | `customer.ts:16-18` |
| customerId is NOT set by this endpoint | Only workspace.ts sets it |

### 1.4 Edge Cases

- **Empty name after trim**: Throws AppError(400, "Name is required")
- **Empty mobile after trim**: Throws AppError(400, "Mobile is required")
- **Duplicate mobile**: Allowed (unique index was dropped per `index.ts:61-74`)
- **Missing optional fields**: All optional fields default to their schema defaults

---

## 2. Visit Creation Flow

### 2.1 Sequence Diagram

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/visits    │                        │
  │ { customerId,       │                        │
  │   visitDate,        │                        │
  │   doctorName,       │                        │
  │   remarks }         │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     │                        │
  │                     ├── Zod validation       │
  │                     │   customerId: string   │
  │                     │                        │
  │                     │                        │
  │                     │   Customer.findById()  │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │   (validate exists)    │
  │                     │                        │
  │                     │   Visit.create()       │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Customer.findByIdAndUpdate│
  │                     │   { $inc: { totalVisits: 1 } }│
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── invalidateCache()    │
  │                     │   "/api/visits"        │
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
```

### 2.2 Data Flow

```
Input:
  {
    customerId: "64a1b2c3d4e5f6...",
    visitDate: "2026-07-16",
    visitType: "new",          // optional, default: "new"
    doctorName: "Dr. Patel",   // optional
    remarks: "First visit"     // optional
  }

Processing:
  1. Validate customerId exists
  2. Parse visitDate (or use now)
  3. Visit.create(...)
  4. Customer.totalVisits += 1

Output:
  {
    _id: ObjectId("..."),
    customerId: ObjectId("..."),
    visitDate: Date("2026-07-16"),
    visitType: "new",
    doctorName: "Dr. Patel",
    createdAt: "2026-07-16T..."
  }
```

### 2.3 Business Rules

| Rule | Code Reference |
|------|----------------|
| Customer must exist | `visits.ts:30-31` |
| totalVisits incremented atomically | `visits.ts:36` — `$inc` |
| totalVisits decremented on delete | `visits.ts:57` — `$inc: -1` |
| visitType defaults to "new" | `visit.ts:8` |
| Max 200 results per query | `visits.ts:24` |

---

## 3. Prescription Creation Flow

### 3.1 Sequence Diagram

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/          │                        │
  │   prescriptions     │                        │
  │ { customerId,       │                        │
  │   visitId,          │                        │
  │   rightEye,         │                        │
  │   leftEye,          │                        │
  │   pd, notes }       │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     │                        │
  │                     ├── Zod validation       │
  │                     │   eye schemas          │
  │                     │   (sph, cyl, axis, va) │
  │                     │                        │
  │                     │   Customer.findById()  │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Visit.findById()     │
  │                     │   (if visitId)         │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Prescription.create()│
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
```

### 3.2 Eye Data Structure

```
Input Structure:
  {
    customerId: "...",
    visitId: "...",                    // optional
    rightEye: {
      dv: { sph: -2.00, cyl: -0.75, axis: 180, va: "6/6" },
      nv: { sph: -0.50, cyl: 0, axis: 0, va: "N6" },
      pc: { sph: -1.00, cyl: -0.50, axis: 175, va: "N8" }
    },
    leftEye: {
      dv: { sph: -1.75, cyl: -0.50, axis: 10, va: "6/6" },
      nv: { sph: -0.25 },
      pc: null
    },
    pd: "62",
    notes: "Mild astigmatism"
  }

Processing:
  1. Validate customerId exists
  2. Validate visitId exists (if provided)
  3. Create prescription with nested eye objects
  4. All eye fields are optional

Output:
  {
    _id: ObjectId("..."),
    customerId: ObjectId("..."),
    visitId: ObjectId("..."),
    rightEye: {
      dv: { sph: -2, cyl: -0.75, axis: 180, va: "6/6" },
      nv: { sph: -0.5, cyl: 0, axis: 0, va: "N6" },
      pc: { sph: -1, cyl: -0.5, axis: 175, va: "N8" }
    },
    leftEye: {
      dv: { sph: -1.75, cyl: -0.5, axis: 10, va: "6/6" },
      nv: { sph: -0.25 },
      pc: null
    },
    pd: "62",
    notes: "Mild astigmatism"
  }
```

### 3.3 Prescription Used In

```
1. Demand List PDF Generation (orders.ts:463-481)
   - Extracts DV/NV values for prescription formatting
   - SPH/CYL/axis formatted as "-2.00 / -0.75 × 180"
   - ADD calculated as NV.sph - DV.sph

2. Dashboard Incomplete Orders (dashboard.ts:132-169)
   - Links prescriptions to orders via visitId
   - Displays stock status per order

3. Client-Side Prescription Panel (PrescriptionPanel.tsx)
   - Form for entering eye measurements
   - DV/NV/PC tabs per eye
```

---

## 4. Order Creation Flow

### 4.1 Sequence Diagram

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/orders    │                        │
  │ { customerId,       │                        │
  │   visitId,          │                        │
  │   frame, lens,      │                        │
  │   coating,          │                        │
  │   quantity,         │                        │
  │   deliveryDate }    │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     ├── audit()              │
  │                     │                        │
  │                     ├── Zod validation       │
  │                     │                        │
  │                     │   Customer.findById()  │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   new Order(data)      │
  │                     │   order.save()         │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── invalidateCache()    │
  │                     │   "/api/orders"        │
  │                     │   "/api/dashboard"     │
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
```

### 4.2 Order Data Flow

```
Input:
  {
    customerId: "...",
    visitId: "...",
    frame: "Ray-Ban Aviator",
    frameBrand: "Ray-Ban",
    frameModel: "RB3025",
    frameColor: "Gold",
    frameSize: "58",
    framePrice: 4500,
    lens: "Progressive",
    lensBrand: "Essilor",
    lensType: "Progressive",
    lensIndex: "1.67",
    lensPrice: 3000,
    coating: "Anti-reflective",
    coatingPrice: 500,
    accessories: ["cleaning cloth", "case"],
    quantity: 1,
    deliveryDate: "2026-07-23"
  }

Processing:
  1. Validate customerId exists
  2. Create Order with defaults:
     - status: "Draft"
     - classification: "pending"
     - rightLensStatus: "pending"
     - leftLensStatus: "pending"
     - reviewed: false
     - forwardedCount: 0

Output:
  {
    _id: ObjectId("..."),
    customerId: ObjectId("..."),
    visitId: ObjectId("..."),
    frame: "Ray-Ban Aviator",
    frameBrand: "Ray-Ban",
    lensBrand: "Essilor",
    coating: "Anti-reflective",
    quantity: 1,
    status: "Draft",
    classification: "pending",
    rightLensStatus: "pending",
    leftLensStatus: "pending",
    framePrice: 4500,
    lensPrice: 3000,
    coatingPrice: 500
  }
```

### 4.3 Order GET Enrichment

```
When orders are listed, each order is enriched with bill info:

orders.ts:91-98:
  For each order:
    1. Get customerId from populated customer
    2. Find latest Bill for that customer
    3. Attach billInfo: { pendingAmount, totalAmount, advancePaid, billNumber }
```

---

## 5. Bill Creation Flow

### 5.1 Sequence Diagram

```
Client                Server                MongoDB    WhatsApp
  │                     │                      │          │
  │ POST /api/bills     │                      │          │
  │ { customerId,       │                      │          │
  │   items, discount,  │                      │          │
  │   tax, advancePaid }│                      │          │
  │────────────────────>│                      │          │
  │                     │                      │          │
  │                     ├── authenticate()     │          │
  │                     ├── branchScope()      │          │
  │                     ├── audit()            │          │
  │                     │                      │          │
  │                     ├── Zod validation     │          │
  │                     │                      │          │
  │                     ├── billNumber =        │          │
  │                     │   "BILL-{timestamp}" │          │
  │                     │                      │          │
  │                     ├── Calculate:         │          │
  │                     │   subtotal = Σ(qty×price)│      │
  │                     │   total = sub-disc+tax│         │
  │                     │   pending = total-adv │          │
  │                     │                      │          │
  │                     │   Bill.create()      │          │
  │                     │─────────────────────>│          │
  │                     │<─────────────────────│          │
  │                     │                      │          │
  │                     │   Customer.update    │          │
  │                     │   totalSpent += total │         │
  │                     │   pending += pending  │         │
  │                     │─────────────────────>│          │
  │                     │<─────────────────────│          │
  │                     │                      │          │
  │                     │─── (async, fire-and-forget) ──> │
  │                     │   Customer.findById  │          │
  │                     │   Settings.findOne   │          │
  │                     │   generateBillPdf()  │          │
  │                     │   wa.sendMedia()     │─────────>│
  │                     │                      │          │
  │                     ├── invalidateCache()  │          │
  │                     │                      │          │
  │   { success, data } │                      │          │
  │<────────────────────│                      │          │
```

### 5.2 Bill Calculation

```
Input Items:
  [
    { description: "Ray-Ban Frame", quantity: 1, unitPrice: 4500 },
    { description: "Essilor Progressive Lens", quantity: 1, unitPrice: 3000 },
    { description: "Anti-reflective Coating", quantity: 1, unitPrice: 500 },
    { description: "Fitting Charge", quantity: 1, unitPrice: 200 }
  ]
  discount: 200
  tax: 100
  advancePaid: 1000

Calculation:
  subtotal = (1×4500) + (1×3000) + (1×500) + (1×200) = 8200
  totalAmount = 8200 - 200 + 100 = 8100
  pendingAmount = max(0, 8100 - 1000) = 7100

Output:
  {
    billNumber: "BILL-1721126400000",
    subtotal: 8200,
    discount: 200,
    tax: 100,
    totalAmount: 8100,
    advancePaid: 1000,
    pendingAmount: 7100,
    items: [...]
  }

Side Effects:
  Customer.totalSpent += 8100
  Customer.pendingAmount += 7100
```

### 5.3 Bill PDF Generation (Async)

```
1. Find customer by customerId
2. Find settings (shop info)
3. generateBillPdf(billData, customerData, settingsData)
   → PDFKit generates A4 PDF
   → Returns Buffer
4. wa.sendMedia(customer.mobile, pdfBuffer.toString("base64"), filename, mimetype, message)
5. If WhatsApp fails → silently ignored (try/catch)

Message text: "Hi {name}, your bill {billNumber} has been generated! Total: ₹{total}."
```

---

## 6. Payment Creation Flow

### 6.1 Sequence Diagram

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/payments  │                        │
  │ { customerId,       │                        │
  │   billId,           │                        │
  │   amount,           │                        │
  │   paymentMode,      │                        │
  │   paymentDate }     │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     ├── audit()              │
  │                     │                        │
  │                     ├── Zod validation       │
  │                     │   amount >= 0.01       │
  │                     │                        │
  │                     │   Payment.create()     │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Bill.findByIdAndUpdate│
  │                     │   { $inc: {            │
  │                     │     advancePaid: amount│
  │                     │   }}                   │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Bill: recalculate    │
  │                     │   pendingAmount =      │
  │                     │   max(0, total-advance)│
  │                     │   bill.save()          │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Customer.findByIdAndUpdate│
  │                     │   { $inc: {            │
  │                     │     pendingAmount:     │
  │                     │     -amount            │
  │                     │   }}                   │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── invalidateCache()    │
  │                     │   "/api/payments"      │
  │                     │   "/api/bills"         │
  │                     │   "/api/dashboard"     │
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
```

### 6.2 Payment Delta Chain

```
When a payment is created with amount=1000:

  Payment: amount=1000 ✓
  Bill: advancePaid += 1000, pendingAmount = max(0, total - advancePaid) ✓
  Customer: pendingAmount -= 1000 ✓

When a payment of 1000 is EDITED to 1500:

  Payment: amount = 1500 (note appended: "Amount changed from ₹1000 to ₹1500")
  Bill: advancePaid += 500 (delta), pendingAmount recalculated ✓
  Customer: pendingAmount -= 500 (delta) ✓

When a payment of 1000 is DELETED:

  Payment: deleted ✓
  Bill: advancePaid -= 1000, pendingAmount recalculated ✓
  Customer: pendingAmount += 1000 (reversed) ✓
```

### 6.3 Payment Modes

```
Valid payment modes (bilingual):
  "Cash"        — English cash
  "नकद"         — Hindi cash
  "UPI"         — UPI payment
  "Card"        — English card
  "कार्ड"        — Hindi card
  "Bank Transfer" — English bank
  "बैंक"         — Hindi bank
  "Insurance"   — English insurance
  "बीमा"         — Hindi insurance

All modes are accepted; no validation on specific values beyond enum.
```

---

## 7. Inventory Update Flow

### 7.1 Stock Adjustment Sequence

```
Client                Server                   MongoDB
  │                     │                        │
  │ PUT /api/inventory  │                        │
  │ /:id/stock          │                        │
  │ { quantity: -2 }    │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     ├── audit()              │
  │                     │                        │
  │                     │   Inventory.findByIdAndUpdate│
  │                     │   { $inc: {            │
  │                     │     quantity: -2       │
  │                     │   }}                   │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── invalidateCache()    │
  │                     │   "/api/inventory"     │
  │                     │                        │
  │   { success, data } │                        │
  │<────────────────────│                        │
```

### 7.2 Inventory in Order Dashboard

```
When dashboard fetches incomplete orders:

1. Find orders with status in [Draft, Ordered, In Lab]
2. For each order, extract lensBrand and frameBrand
3. Query Inventory for items matching those brands
4. Build stockMap: { brand → { shop: qty, warehouse: qty } }
5. Attach to each order: stockStatus.lensBrand, stockStatus.frameBrand

Result per order:
  {
    ...order,
    stockStatus: {
      lensBrand: { shop: 15, warehouse: 5 },
      frameBrand: { shop: 3, warehouse: 0 }
    }
  }
```

### 7.3 QR Code Flow

```
Scan QR Code:
  1. CameraScanner component captures camera frame
  2. jsQR decodes QR image to text
  3. Navigate to /inventory/scan/{decoded_text}
  4. ItemScan page calls GET /api/inventory/qr/{code}
  5. Server: Inventory.findOne({ sku: code })
  6. Display item details

Generate QR Code:
  1. Call GET /api/inventory/:id/qr-image
  2. Server: QRCode.toBuffer(item.sku, { type: "png", width: 400 })
  3. Return PNG image
```

---

## 8. Delivery Tracking Flow

### 8.1 Delivery Creation Flow

```
Delivery is created in two ways:

Method 1: Via Workspace Transaction
  POST /api/workspace/transaction
  → delivery: { address, expectedDeliveryDate }
  → Delivery.create({ customerId, orderId, ... })

Method 2: Via Order Status Update (auto-creation implicit)
  When order status changes → delivery status auto-updates
```

### 8.2 Delivery Status Auto-Update

```
Order Status Change        →  Delivery Status Change
─────────────────────────────────────────────────────
Order → "Ready" (full qty) →  Delivery → "Ready"
Order → "Delivered" (full qty) → Delivery → "Delivered"
                                  + actualDeliveryDate = now
Order → "Cancelled" (full qty) → Delivery → "Cancelled"

Constraint: Auto-update only on FULL quantity advancement
  (when forwardedCount >= quantity)
```

### 8.3 Delivery Query Flow

```
Client                Server                   MongoDB
  │                     │                        │
  │ GET /api/delivery   │                        │
  │ ?status=Ready       │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     │   Delivery.find()      │
  │                     │   .populate(customer)  │
  │                     │   .populate(order)     │
  │                     │   .sort(createdAt -1)  │
  │                     │   .limit(200)          │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │   { data: [         │                        │
  │     { _id,          │                        │
  │       customer: {   │                        │
  │         name, mobile│                        │
  │       },            │                        │
  │       order: {      │                        │
  │         frame, lens,│                        │
  │         status      │                        │
  │       },            │                        │
  │       status: "Ready",│                     │
  │       expectedDate  │                        │
  │     }               │                        │
  │   ]}                │                        │
  │<────────────────────│                        │
```

---

## 9. WhatsApp Notification Flow

### 9.1 Bill PDF Notification Flow

```
Bill Created
    │
    ▼
Async IIFE (fire-and-forget)
    │
    ├── Customer.findById(bill.customerId)
    │   → get name, mobile
    │
    ├── Settings.findOne()
    │   → get shopName, shopAddress, shopPhone, logo
    │
    ├── generateBillPdf(bill, customer, settings)
    │   → PDFKit generates PDF buffer
    │
    ├── whatsappManager.getInstance(branchId)
    │   → get branch's WhatsApp instance
    │
    ├── wa.sendMedia(mobile, pdfBase64, filename, mimetype, message)
    │
    ├── If connected: send immediately
    │   └── sock.sendMessage(jid, { document: buffer })
    │
    └── If offline: queue message
        └── messageQueue.push(...)
        └── Drain on next reconnect

Message: "Hi {name}, your bill {billNumber} has been generated! Total: ₹{total}."
```

### 9.2 Order Status Notification Flow

```
Order Status → "Ready"
    │
    ├── Validate: newForwarded >= qty (full advancement)
    │
    ├── Customer.findById(order.customerId)
    │   → get name, mobile
    │
    ├── Settings.findOne()
    │   → get shopName
    │
    ├── Build message:
    │   "*{shopName}* 🕶\n\n
    │    Hi {name},\n
    │    Your order is ready for pickup! 🎉\n\n
    │    Items: {frame}, {lens}, {coating}\n
    │    Delivery Date: {date}\n\n
    │    Please visit the store to collect your order.\n
    │    Thank you! 🙏"
    │
    └── wa.sendMessage(mobile, message)
```

### 9.3 WhatsApp Message Queue

```
WhatsAppService:
  messageQueue: QueueItem[]

  sendMessage(phone, message):
    if connected:
      → sock.sendMessage(jid, { text: message })
      → return { ok: true }
    else:
      → messageQueue.push({ type: "text", phone, message })
      → return { ok: false, error: "Not connected" }

  drainQueue() (called on reconnect):
    → Process all queued items sequentially
    → 500ms delay between sends
    → Remove successfully sent items
    → Keep failed items in queue
```

### 9.4 Broadcast Flow

```
POST /api/whatsapp/broadcast
  { numbers: [...], message, antiban, media }
    │
    ├── Validate: numbers.length > 0
    ├── Clean numbers: remove non-digits, filter length >= 10
    │
    ├── For each number:
    │   ├── If media: wa.sendMedia(number, base64, filename, mimetype)
    │   ├── If text: wa.sendMessage(number, message)
    │   ├── Track: { phone, status: "sent" | "failed" }
    │   │
    │   ├── Anti-ban delay:
    │   │   random(2000ms - 5000ms) between messages
    │   │
    │   └── Batch pause:
    │       Every 20 messages: pause 15000ms + random(5000ms)
    │
    └── Return: { sent, failed, results[] }
```

---

## 10. Dashboard Aggregation Flow

### 10.1 Dashboard Data Pipeline

```
GET /api/dashboard/stats
    │
    ├── branchScope → load branch models
    ├── authenticate → verify JWT
    ├── cache(30s) → check Redis
    │
    ▼
20+ Parallel MongoDB Aggregations via Promise.all([
    │
    ├── [1] Customer.countDocuments()
    ├── [2] Order.countDocuments()
    ├── [3] Bill.countDocuments()
    ├── [4] Payment.countDocuments()
    ├── [5] Inventory.countDocuments()
    ├── [6] Delivery.countDocuments()
    ├── [7] Visit.countDocuments()
    │
    ├── [8] Bill.aggregate(today → sum totalAmount)
    ├── [9] Payment.aggregate(today → sum amount)
    ├── [10] Bill.aggregate(week → sum totalAmount)
    ├── [11] Bill.aggregate(month → sum totalAmount)
    │
    ├── [12] Delivery.countDocuments({status: "Ready"})
    ├── [13] Customer.countDocuments(today)
    ├── [14] Inventory.countDocuments({quantity ≤ 5})
    │
    ├── [15] Payment.aggregate(pending bills via $lookup)
    │
    ├── [16] Customer.find().sort(createdAt -1).limit(5)
    ├── [17] Order.find().sort(createdAt -1).limit(5)
    │
    ├── [18] Delivery.find(today + pending/ready).limit(10)
    ├── [19] Bill.find(pendingAmount > 0).sort(pendingAmount -1).limit(5)
    │
    ├── [20] async IIFE: incomplete orders + stock cross-reference
    │         ├── Order.find({status: [Draft, Ordered, In Lab]})
    │         ├── Prescription.find({visitId: $in visitIds})
    │         ├── Inventory.find({brand: $in brandNames})
    │         └── Build stockMap per brand
    │
    ├── [21] Order.countDocuments(today)
    ├── [22] Order.countDocuments(week)
    ├── [23] Order.countDocuments(month)
    ├── [24] Bill.countDocuments(today)
    ├── [25] Bill.countDocuments(week)
    ├── [26] Bill.countDocuments(month)
    │
    ├── [27] Bill.aggregate(30-day daily sales)
    ├── [28] Payment.aggregate(paymentMode split)
    ├── [29] Order.aggregate(status counts)
    ├── [30] Bill.aggregate(same day last week)
    └── [31] Order.find(delivered today)
    │
    ])
    │
    ├── Calculate: salesTrend = % change vs last week
    │
    ├── Assemble response object (~25 fields)
    │
    └── Cache for 30 seconds
```

### 10.2 Dashboard Response Shape

```
{
  counts: {
    customers, orders, bills, payments, inventory, deliveries, visits
  },
  todaySales: number,
  todayCollection: number,
  weekSales: number,
  monthSales: number,
  readyDeliveries: number,
  newCustomersToday: number,
  lowStock: number,
  pendingPayments: number,
  recentCustomers: Customer[],
  recentOrders: Order[],
  todayDeliveries: Delivery[],
  pendingBills: Bill[],
  incompleteOrders: Order[],  // with stockStatus
  todayOrders: number,
  weekOrders: number,
  monthOrders: number,
  todayBills: number,
  weekBills: number,
  monthBills: number,
  dailySales: { date: string, total: number }[],
  paymentModeSplit: { mode: string, total: number, count: number }[],
  orderStatusCounts: { status: string, count: number }[],
  salesTrend: string,  // percentage
  todayDeliveredOrders: Order[]
}
```

---

## 11. Workspace Transaction Flow

### 11.1 Complete Workspace Sequence

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/          │                        │
  │  workspace/         │                        │
  │  transaction        │                        │
  │ { customer, visit,  │                        │
  │   prescription,     │                        │
  │   order, bill,      │                        │
  │   payment, delivery }│                       │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── authenticate()       │
  │                     ├── branchScope()        │
  │                     │                        │
  │                     ├── STEP 1: CUSTOMER     │
  │                     │   Find or create       │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 2: VISIT        │
  │                     │   Visit.create()       │
  │                     │───────────────────────>│
  │                     │                        │
  │                     │   Customer.totalVisits++│
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 3: PRESCRIPTION │
  │                     │   Prescription.create()│
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 4: ORDER        │
  │                     │   Order.create()       │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 5: BILL         │
  │                     │   Bill.create()        │
  │                     │───────────────────────>│
  │                     │                        │
  │                     │   Customer.totalSpent++│
  │                     │   Customer.pending +=  │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 6: PAYMENT      │
  │                     │   Payment.create()     │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── STEP 7: DELIVERY     │
  │                     │   Delivery.create()    │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     ├── Invalidate ALL caches│
  │                     │                        │
  │   { success, data:  │                        │
  │     { customer,     │                        │
  │       visit,        │                        │
  │       prescription, │                        │
  │       order,        │                        │
  │       bill,         │                        │
  │       payment,      │                        │
  │       delivery }    │                        │
  │   }                 │                        │
  │<────────────────────│                        │
```

### 11.2 Workspace Customer Resolution

```
Customer resolution priority:

1. If customerId provided → Customer.findById(customerId)
2. If customer._id provided → Customer.findById(customer._id)
3. If customer.mobile provided → Customer.findOne({ mobile })
4. If none found + customer object → Customer.create (NEW customer)

This means:
  - Returning customer: use customerId or mobile
  - New customer: provide customer object with name + mobile
  - System auto-deduplicates by mobile
```

### 11.3 Workspace Bill Calculation

```
Bill in workspace:
  - subtotal: computed from items (if provided)
  - discount: from input (default 0)
  - totalAmount: from input (default 0)
  - advancePaid: payment.amount (if payment provided)
  - pendingAmount: max(0, totalAmount - advancePaid)

Note: Workspace bill uses totalAmount from input, NOT computed from items.
The items array is stored but totalAmount is taken directly from the request.
```

### 11.4 Workspace Edge Cases

| Scenario | Behavior |
|----------|----------|
| Customer already exists (same mobile) | Found via `findOne({ mobile })`, not duplicated |
| Visit without prescription | Visit created, prescription is null |
| Order without visit | Order created with visitId=null |
| Bill without items | Bill created with subtotal=0, totalAmount=0 |
| Payment with amount=0 | Payment NOT created |
| Delivery without order | Delivery created with orderId=null |
| Any step fails | Previous steps remain (no rollback) |

---

## 12. Order Status Transition Flow

### 12.1 Full Transition Sequence

```
Client                Server                   MongoDB    WhatsApp
  │                     │                        │          │
  │ PATCH /api/orders   │                        │          │
  │ /:id/status         │                        │          │
  │ { status: "Ready",  │                        │          │
  │   advanceQuantity:1 }│                       │          │
  │────────────────────>│                        │          │
  │                     │                        │          │
  │                     ├── Validate transition   │          │
  │                     │   "In Lab" → "Ready"   │          │
  │                     │   is in VALID_TRANSITIONS│         │
  │                     │                        │          │
  │                     ├── Calculate advancement │          │
  │                     │   advQty: 1            │          │
  │                     │   forwarded: 0+1=1     │          │
  │                     │   qty: 1 (full)        │          │
  │                     │   → Full advancement   │          │
  │                     │                        │          │
  │                     │   Order.status = "Ready"│         │
  │                     │   forwardedCount = 0   │          │
  │                     │───────────────────────>│          │
  │                     │<───────────────────────│          │
  │                     │                        │          │
  │                     ├── Delivery update       │          │
  │                     │   status → "Ready"     │          │
  │                     │───────────────────────>│          │
  │                     │<───────────────────────│          │
  │                     │                        │          │
  │                     ├── WhatsApp notification │         │
  │                     │   "Order ready!"       │─────────>│
  │                     │                        │          │
  │                     ├── No payment (not Delivered)     │
  │                     │                        │          │
  │                     ├── Invalidate caches    │          │
  │                     │                        │          │
  │   { success, data:  │                        │          │
  │     { order,        │                        │          │
  │       partial: false,│                       │          │
  │       delivery }    │                        │          │
  │   }                 │                        │          │
  │<────────────────────│                        │          │
```

### 12.2 Partial Advancement Example

```
Order: quantity=3, status="Ordered", forwardedCount=0

Transition 1: advanceQuantity=1
  forwarded: 0+1=1 < 3
  → partial advancement
  → forwardedCount = 1
  → status stays "Ordered"

Transition 2: advanceQuantity=1
  forwarded: 1+1=2 < 3
  → partial advancement
  → forwardedCount = 2
  → status stays "Ordered"

Transition 3: advanceQuantity=1
  forwarded: 2+1=3 >= 3
  → FULL advancement
  → status = "In Lab"
  → forwardedCount = 0
  → Delivery status auto-updated
  → WhatsApp notification sent
```

### 12.3 Payment Collection on Delivery

```
When status="Delivered" with collectPayment:

1. Find bill by visitId (or latest bill for customer)
2. If bill exists AND pendingAmount > 0:
   a. Create Payment record
   b. Bill.advancePaid += collectPayment
   c. Bill.pendingAmount = max(0, totalAmount - advancePaid)
   d. Customer.pendingAmount -= collectPayment
3. Return payment + bill in response
```

---

## 13. Demand List Generation Flow

### 13.1 Demand List Sequence

```
Client                Server                   MongoDB    WhatsApp
  │                     │                        │          │
  │ POST /api/orders    │                        │          │
  │ /demand-send        │                        │          │
  │ { type: "buy",      │                        │          │
  │   orderIds: [...] } │                        │          │
  │────────────────────>│                        │          │
  │                     │                        │          │
  │                     ├── Find matching orders  │          │
  │                     │   rightLensStatus=type  │         │
  │                     │   OR leftLensStatus=type│         │
  │                     │   OR classification=type│         │
  │                     │───────────────────────>│          │
  │                     │<───────────────────────│          │
  │                     │                        │          │
  │                     ├── Find prescriptions    │          │
  │                     │   for matched visits    │         │
  │                     │───────────────────────>│          │
  │                     │<───────────────────────│          │
  │                     │                        │          │
  │                     ├── Build per-eye entries │          │
  │                     │   For each order:       │         │
  │                     │     If right matches:   │         │
  │                     │       entry { eye: "R" }│         │
  │                     │     If left matches:    │         │
  │                     │       entry { eye: "L" }│         │
  │                     │                        │          │
  │                     ├── generateDemandPdf()   │          │
  │                     │   PDFKit table          │          │
  │                     │───────────────────────>│          │
  │                     │<───────────────────────│          │
  │                     │                        │          │
  │                     ├── Send to shop owner    │          │
  │                     │   Settings.shopPhone    │          │
  │                     │   wa.sendMedia()        │─────────>│
  │                     │                        │          │
  │   { success, data:  │                        │          │
  │     { sent,         │                        │          │
  │       queued,       │                        │          │
  │       count,        │                        │          │
  │       filename }    │                        │          │
  │   }                 │                        │          │
  │<────────────────────│                        │          │
```

### 13.2 Demand PDF Structure

```
PDF Layout (A4):
┌──────────────────────────────────────┐
│  HEADER (dark background)            │
│  "PURCHASE LIST" or "LAB ORDER LIST" │
├──────────────────────────────────────┤
│  Date: Mon, 16 Jul 2026             │
│  Items: 5              KMJ Optical   │
├──────────────────────────────────────┤
│  # │ Eye │ Customer │ Lens │ Coating │ Rx         │
│  1 │ R   │ Rahul    │ 1.67 │ AR      │ -2.00 ... │
│  2 │ L   │ Rahul    │ 1.67 │ AR      │ -1.75 ... │
│  3 │ R   │ Priya    │ 1.74 │ MC      │ -3.00 ... │
├──────────────────────────────────────┤
│  Generated by KMJ Optical ERP       │
└──────────────────────────────────────┘
```

### 13.3 Prescription Formatting

```
formatRxStr(dv, nv, pd):
  "SPH -2.00 / -0.75 × 180  ADD +1.00  PD 62"

Components:
  SPH = dv.sph (formatted with +/-)
  CYL = dv.cyl (if present)
  Axis = dv.axis (if present)
  ADD = nv.sph - dv.sph (for progressive)
  PD = prescription.pd
```

---

## 14. Authentication Flow

### 14.1 Admin Login Sequence

```
Client                Server                   MongoDB
  │                     │                        │
  │ POST /api/auth/login│                        │
  │ { username,         │                        │
  │   password,         │                        │
  │   branchId }        │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     │   User.findOne()       │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │                     │   Validate role≠staff   │
  │                     │   bcrypt.compare()     │
  │                     │                        │
  │                     │   signAccess(payload)  │
  │                     │   signRefresh(payload) │
  │                     │                        │
  │                     │   Format user+branches │
  │                     │   Owner → all branches │
  │                     │                        │
  │   { success, data:  │                        │
  │     { user,         │                        │
  │       access,       │                        │
  │       refresh,      │                        │
  │       branchId }    │                        │
  │   }                 │                        │
  │<────────────────────│                        │
  │                     │                        │
  │ Store in AuthContext │                        │
  │ localStorage:       │                        │
  │   token, refresh,   │                        │
  │   user, branchId    │                        │
```

### 14.2 Staff Login vs Admin Login

```
Admin Login (POST /api/auth/login):
  - Validates role ≠ "staff"
  - Auto-selects first available branch
  - Returns all active branches

Staff Login (POST /api/auth/staff-login):
  - Validates role = "staff"
  - Auto-detects branch from user.branches[0]
  - Returns assigned branch only

Warehouse Login (POST /api/auth/warehouse-login):
  - Validates role ∈ ["warehouse", "owner"]
  - No branch assignment
  - Used by warehouse/ React app
```

---

## 15. Branch Scope Flow

### 15.1 Branch Resolution Sequence

```
Client                Server                   MongoDB
  │                     │                        │
  │ GET /api/customers  │                        │
  │ Header:             │                        │
  │  X-Branch-ID: abc123│                       │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── branchScope()        │
  │                     │   Extract header       │
  │                     │                        │
  │                     │   Branch.findById()    │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │   (branch found)       │
  │                     │                        │
  │                     │   getBranchModels()    │
  │                     │   → useDb("kmj_xxx")   │
  │                     │   → register models    │
  │                     │   → cache in Map       │
  │                     │                        │
  │                     │   ctx.run(context,     │
  │                     │     () => next())      │
  │                     │                        │
  │                     │   withBranch Proxy     │
  │                     │   intercepts model     │
  │                     │   calls to use branch  │
  │                     │   database models      │
  │                     │                        │
  │                     │   Customer.find()      │
  │                     │   → runs on branch DB  │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │                        │
  │   { data: [...] }   │                        │
  │<────────────────────│                        │
```

---

## 16. Cache Invalidation Flow

### 16.1 Cache Hit Flow

```
Client                Server                   Redis
  │                     │                        │
  │ GET /api/customers  │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── cacheMiddleware      │
  │                     │   key = "abc123:/api/customers?page=1"
  │                     │                        │
  │                     │   cacheGet(key)        │
  │                     │───────────────────────>│
  │                     │<───────────────────────│
  │                     │   (HIT)                │
  │                     │                        │
  │   x-cache: HIT      │                        │
  │   { cached data }   │                        │
  │<────────────────────│                        │
```

### 16.2 Cache Miss Flow

```
Client                Server                   Redis
  │                     │                        │
  │ GET /api/customers  │                        │
  │────────────────────>│                        │
  │                     │                        │
  │                     ├── cacheMiddleware      │
  │                     │   cacheGet → null (MISS)│
  │                     │                        │
  │                     │   Intercept res.json() │
  │                     │   Pass to route handler│
  │                     │                        │
  │                     │   Route handler runs   │
  │                     │   → MongoDB queries    │
  │                     │   → Build response     │
  │                     │                        │
  │                     │   res.json(response)   │
  │                     │   ↓ intercepted        │
  │                     │   cacheSet(key, data)  │
  │                     │───────────────────────>│
  │                     │                        │
  │   x-cache: MISS     │                        │
  │   { fresh data }    │                        │
  │<────────────────────│                        │
```

### 16.3 Cache Invalidation Flow

```
Mutation (POST/PUT/DELETE)
    │
    ├── Handler runs business logic
    │
    ├── After successful mutation:
    │   ├── invalidateCache("/api/customers")
    │   │   → cacheDel("*:/api/customers*")
    │   │   → SCAN for matching keys
    │   │   → Pipeline DEL all matches
    │   │
    │   └── invalidateCache("/api/dashboard")
    │       → cacheDel("*:/api/dashboard*")
    │       → Dashboard always invalidated on any mutation
    │
    └── Response sent to client
        → Next GET request will be cache MISS
        → Fresh data fetched from MongoDB
        → Cached for TTL seconds
```

---

## AI Instructions for Using This Knowledge

When working with data flows:

1. **Denormalized fields need dual writes**: Every flow that touches Customer.totalVisits/totalSpent/pendingAmount must update both the primary entity AND the customer counters.

2. **Cache invalidation is mandatory**: After any mutation, invalidate the specific route AND /api/dashboard. Missing invalidation causes stale data.

3. **WhatsApp is async/fire-and-forget**: Never await WhatsApp operations. Always wrap in async IIFE with try/catch. Bill/order operations must not be blocked.

4. **Workspace is not transactional**: If step 3 of 7 fails, steps 1-2 remain. This is by design — there's no rollback mechanism.

5. **Status transitions are state machines**: Never set status directly. Always use PATCH /:id/status which validates allowed transitions.

6. **Partial advancement complicates flows**: Orders with quantity > 1 may require multiple status updates before the actual transition occurs. Check `forwardedCount` in responses.

7. **Bill number uniqueness**: Uses `BILL-{timestamp}`. Rapid bill creation could theoretically collide, but timestamp-based generation provides sufficient uniqueness for this scale.

8. **Mobile is the deduplication key**: In workspace flow, `Customer.findOne({ mobile })` prevents duplicate customers. This is the only deduplication mechanism.

9. **Redis is optional**: All cache operations gracefully degrade. If Redis is down, every request hits MongoDB directly.

10. **Branch context is per-request**: AsyncLocalStorage ensures branch models are only valid within the current request. Never store branch models outside request scope.
