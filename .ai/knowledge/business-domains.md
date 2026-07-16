# KMJ Optical ERP — Business Domain Documentation

> Complete business domain documentation for the KMJ Optical ERP system.
> Each section covers the domain model, business rules, constraints, and implementation references.

---

## Table of Contents

1. [Customer Management](#1-customer-management)
2. [Visit Management](#2-visit-management)
3. [Prescription Domain](#3-prescription-domain)
4. [Order Management](#4-order-management)
5. [Billing Domain](#5-billing-domain)
6. [Payment Domain](#6-payment-domain)
7. [Inventory Domain](#7-inventory-domain)
8. [Delivery Domain](#8-delivery-domain)
9. [WhatsApp Integration](#9-whatsapp-integration)
10. [Multi-Branch Domain](#10-multi-branch-domain)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Todo / Task Domain](#12-todo--task-domain)

---

## 1. Customer Management

### 1.1 Domain Overview

Customer management is the foundational domain. Every other transactional entity (Visit, Prescription, Order, Bill, Payment, Delivery) references a Customer. The system supports optician-specific customer attributes such as eye prescriptions, tags for segmentation, and aggregated lifetime metrics.

**Implementation files:**
- Model: `server/src/models/customer.ts`
- Controller: `server/src/controllers/customerController.ts`
- Routes: `server/src/routes/customers.ts`
- Frontend page: `client/src/pages/Customers.tsx`, `client/src/pages/CustomerDetail.tsx`

### 1.2 Data Model

```
Customer {
  _id: ObjectId (auto)
  customerId: String          // Display ID like "CUST-1710000000000"
  name: String (required)     // Customer full name
  email: String (optional)
  age: Number (optional)
  gender: String (optional)
  mobile: String (required at creation)  // Primary phone number
  alternateMobile: String (optional)
  address: String (optional)
  city: String (optional)
  tags: String[] (default [])           // Freeform tags for segmentation
  totalVisits: Number (default 0)       // Denormalized visit count
  totalSpent: Number (default 0)        // Denormalized lifetime spend
  pendingAmount: Number (default 0)     // Denormalized outstanding amount
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 1.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-C01 | Customer name is required | `customerController.ts:48` — validates `name?.trim()` |
| BR-C02 | Mobile number is required at creation | `customerController.ts:49` — validates `mobile?.trim()` |
| BR-C03 | Mobile is trimmed before storage | `customerController.ts:50` — `mobile: mobile.trim()` |
| BR-C04 | customerId is auto-generated using timestamp | `workspace.ts:74` — `CUST-${Date.now()}` |
| BR-C05 | Deleting a customer cascades deletion to all child entities | `customerController.ts:64-71` — deletes Visit, Order, Bill, Prescription, Payment, Delivery |
| BR-C06 | totalVisits is denormalized — incremented on Visit creation, decremented on Visit deletion | `visits.ts:36`, `visits.ts:57` |
| BR-C07 | totalSpent is denormalized — incremented when Bill is created, adjusted on Bill update/delete | `bills.ts:61-63`, `bills.ts:137-143`, `bills.ts:155-156` |
| BR-C08 | pendingAmount is denormalized — adjusted on Bill creation, Payment creation/update/delete | `bills.ts:62`, `payments.ts:57-59`, `payments.ts:93-95`, `payments.ts:121` |
| BR-C09 | Search supports regex across name, mobile, customerId, email, alternateMobile, city | `customerController.ts:23-29` |
| BR-C10 | Customer summary endpoint returns visitCount, orderCount, totalBilled | `customerController.ts:75-92` |

### 1.4 Common Scenarios

**Scenario: New customer via Workspace**
1. User opens Workspace page
2. Enters customer details (name, mobile, etc.)
3. System generates `customerId` with `CUST-{timestamp}`
4. Customer is saved to MongoDB
5. All dashboard caches are invalidated

**Scenario: Customer search**
1. User types in search box
2. Frontend debounces input (typically 300ms)
3. API call to `GET /api/customers?search={query}`
4. Backend builds `$or` regex filter across 6 fields
5. Returns paginated results with total count

**Scenario: Customer deletion**
1. User clicks delete on CustomerDetail page
2. Confirmation dialog shown
3. API call to `DELETE /api/customers/:id`
4. System deletes customer + all related Visit, Order, Bill, Prescription, Payment, Delivery records
5. Dashboard and customer caches invalidated

### 1.5 Edge Cases

- **Duplicate mobile numbers**: Not enforced at database level (unique index was dropped per `index.ts:61-74` due to MongoDB 8.x null handling). Application does not prevent duplicates.
- **Empty mobile**: Trimmed but not validated as a phone format. Empty string after trim will cause creation failure.
- **Customer with pending amount**: Deleting a customer with pending amounts does not warn — it cascades silently.

---

## 2. Visit Management

### 2.1 Domain Overview

A Visit represents a single customer visit to the optical shop. Each visit can have a type indicating the purpose, a doctor name if an eye exam was performed, and optionally link to a shop/branch. Visits are the linking entity between Customers and Prescriptions/Orders.

**Implementation files:**
- Model: `server/src/models/visit.ts`
- Routes: `server/src/routes/visits.ts`
- Frontend: `client/src/pages/NewVisit.tsx`, `client/src/pages/CustomerNewVisit.tsx`

### 2.2 Data Model

```
Visit {
  _id: ObjectId (auto)
  customerId: ObjectId → Customer (required, indexed)
  visitDate: Date (default: now, indexed)
  visitType: Enum ["new" | "frame_change" | "new_lens" | "contact_lens" | "service" | "other"]
             default: "new"
  doctorName: String (optional)
  shop: String (optional)
  shopId: ObjectId (optional)
  remarks: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 2.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-V01 | Visit requires valid customerId | `visits.ts:30-31` — validates customer exists |
| BR-V02 | Visit defaults to current date if not provided | `visits.ts:34` — `visitDate ? new Date(visitDate) : new Date()` |
| BR-V03 | Visit creation increments customer's totalVisits | `visits.ts:36` — `$inc: { totalVisits: 1 }` |
| BR-V04 | Visit deletion decrements customer's totalVisits | `visits.ts:57` — `$inc: { totalVisits: -1 }` |
| BR-V05 | Visit types: new, frame_change, new_lens, contact_lens, service, other | `visit.ts:8` — enum validation |
| BR-V06 | Maximum 200 visits returned per query | `visits.ts:24` — `.limit(200)` |

### 2.4 Visit Types Explained

| Type | Description | Typical Flow |
|------|-------------|--------------|
| `new` | First-time customer visit | New customer → Visit → Prescription → Order → Bill |
| `frame_change` | Customer wants new frames only | Existing customer → Visit → Order (frame only) → Bill |
| `new_lens` | Customer needs new lenses | Existing customer → Visit → Prescription → Order (lens only) → Bill |
| `contact_lens` | Contact lens purchase | Customer → Visit → Order (contact lens) → Bill |
| `service` | Cleaning, adjustment, repair | Customer → Visit → Bill (service charge) |
| `other` | Miscellaneous visit | Customer → Visit |

### 2.5 Common Scenarios

**Scenario: New Visit from Customer Detail page**
1. User navigates to `/customers/:id/create-visit`
2. CustomerNewVisit page loads with pre-selected customer
3. User fills: visit date, visit type, doctor name, remarks
4. On submit, workspace transaction creates: Visit → Prescription → Order → Bill (atomic)

**Scenario: Quick Visit from Workspace**
1. User opens Workspace
2. Searches/creates customer
3. Fills visit + prescription + order + bill + payment in single form
4. Single API call to `POST /api/workspace/transaction`
5. All entities created atomically

---

## 3. Prescription Domain

### 3.1 Domain Overview

The Prescription domain stores optometric eye measurements. Each prescription is for a specific customer and optionally linked to a visit. The system supports standard optometry fields: SPH (sphere), CYL (cylinder), axis, VA (visual acuity) for three vision types per eye (DV, NV, PC).

**Implementation files:**
- Model: `server/src/models/prescription.ts`
- Routes: `server/src/routes/prescriptions.ts`
- Frontend: `client/src/components/NewvistePage/PrescriptionPanel.tsx`

### 3.2 Data Model

```
Eye {
  sph: Number (optional)      // Sphere power (-20 to +20 typical)
  cyl: Number (optional)      // Cylinder power
  axis: Number (optional)     // Axis in degrees (0-180)
  va: String (optional)       // Visual acuity (e.g., "6/6", "20/20")
}

Prescription {
  _id: ObjectId (auto)
  customerId: ObjectId → Customer (required)
  visitId: ObjectId → Visit (optional)
  rightEye: {
    dv: Eye                  // Distance Vision
    nv: Eye                  // Near Vision
    pc: Eye                  // Progressive/Computer
  }
  leftEye: {
    dv: Eye
    nv: Eye
    pc: Eye
  }
  pd: String (optional)       // Pupillary Distance
  notes: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 3.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-P01 | Prescription requires valid customerId | `prescriptions.ts:39-40` |
| BR-P02 | If visitId is provided, visit must exist | `prescriptions.ts:41-44` |
| BR-P03 | All eye fields are optional | Zod schema — all marked `.optional()` |
| BR-P04 | DV = Distance Vision (for driving, TV) | Domain convention |
| BR-P05 | NV = Near Vision (for reading, phone) | Domain convention |
| BR-P06 | PC = Progressive/Computer (intermediate) | Domain convention |
| BR-P07 | SPH values: positive = hyperopia, negative = myopia | Optometry standard |
| BR-P08 | CYL must be between -6.00 and 0 in typical use | Optometry standard |
| BR-P09 | Axis is 0-180 degrees | Optometry standard |
| BR-P10 | Maximum 200 prescriptions per query | `prescriptions.ts:33` |

### 3.4 Eye Notation Explained

```
Right Eye (OD) — from Latin "oculus dexter"
Left Eye (OS)  — from Latin "oculus sinister"

DV (Distance Vision): Used for far-away objects — driving, watching TV
NV (Near Vision):     Used for close objects — reading, phone
PC (Progressive/Computer): Intermediate distance — computer screens

SPH (Sphere): ±20.00 diopters
CYL (Cylinder): -6.00 to 0 diopters (usually negative)
Axis: 1° to 180°
VA (Visual Acuity): "6/6" metric, "20/20" imperial
```

### 3.5 Prescription in Demand List Generation

When generating demand PDFs (lab orders or purchase lists), the system extracts prescription data from the visit's linked prescription:

```
orders.ts:463-481 — formatRxStr function:
  SPH + CYL + axis  →  e.g., "-2.00 / -0.75 × 180"
  ADD (NV - DV)     →  additional near power for progressive lenses
  PD                →  pupillary distance
```

---

## 4. Order Management

### 4.1 Domain Overview

Orders represent the core transactional entity — the customer's purchase of frames, lenses, and coatings. Orders have a status lifecycle, classification system, and link to prescriptions, bills, and deliveries. This is the most complex domain with the most business logic.

**Implementation files:**
- Model: `server/src/models/order.ts`
- Routes: `server/src/routes/orders.ts` (587 lines — largest route file)
- Frontend: `client/src/pages/Orders.tsx`, `client/src/components/NewvistePage/OrderItems.tsx`

### 4.2 Data Model

```
Order {
  _id: ObjectId (auto)
  customerId: ObjectId → Customer (required, indexed)
  visitId: ObjectId → Visit (optional)

  // Frame details
  frame: String (optional)           // Frame name/description
  frameBrand: String (optional)
  frameModel: String (optional)
  frameColor: String (optional)
  frameSize: String (optional)
  framePrice: Number (default: 0)

  // Lens details
  lens: String (optional)
  lensBrand: String (optional)
  lensType: String (optional)
  lensIndex: String (optional)
  lensPrice: Number (default: 0)

  // Coating
  coating: String (optional)
  coatingPrice: Number (default: 0)

  // Quantity & Delivery
  accessories: String[] (default: [])
  quantity: Number (default: 1)
  forwardedCount: Number (default: 0)    // For partial quantity advancement
  deliveryDate: Date (optional)
  actualDeliveryDate: Date (optional)

  // Status & Classification
  status: Enum ["Draft" | "Ordered" | "In Lab" | "Ready" | "Delivered" | "Cancelled"]
         default: "Draft"
  classification: Enum ["pending" | "stock" | "buy" | "order"]
                 default: "pending"
  rightLensStatus: Enum ["pending" | "stock" | "buy" | "order"]
                  default: "pending"
  leftLensStatus: Enum ["pending" | "stock" | "buy" | "order"]
                  default: "pending"

  // Lab info
  labAssigned: String (optional)
  labExpectedDate: Date (optional)
  labRemarks: String (optional)
  reviewed: Boolean (default: false)

  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 4.3 Status State Machine

```
                     ┌──────────┐
                     │  Draft   │
                     └────┬─────┘
                          │
              ┌───────────┼───────────┐
              ▼                       ▼
      ┌──────────┐            ┌────────────┐
      │ Ordered  │            │ Cancelled  │
      └────┬─────┘            └────────────┘
           │                   (terminal)
    ┌──────┼──────────┐
    ▼                  ▼
┌─────────┐    ┌────────────┐
│ In Lab  │    │ Cancelled  │
└────┬────┘    └────────────┘
     │
┌────┼──────────┐
▼                ▼
┌────────┐   ┌────────────┐
│ Ready  │   │ Cancelled  │
└───┬────┘   └────────────┘
    │
    ▼
┌───────────┐
│ Delivered │
└───────────┘ (terminal)
```

**Valid Transitions** (from `orders.ts:21-28`):
```
Draft:       → Ordered, Cancelled
Ordered:     → In Lab, Cancelled
In Lab:      → Ready, Cancelled
Ready:       → Delivered, Cancelled
Delivered:   → (none)
Cancelled:   → (none)
```

### 4.4 Partial Quantity Advancement

Orders support partial quantity processing. An order with `quantity: 3` can advance one item at a time:

```
orders.ts:185-197:
  advQty = advanceQuantity ?? qty        // Default: advance all
  newForwarded = currentForwarded + advQty
  if (newForwarded >= qty) {
    order.status = status                // Full advancement
    order.forwardedCount = 0
  } else {
    order.forwardedCount = newForwarded  // Partial advancement
  }
```

**Example**: Order has quantity=3, status=Ordered
- Advance 1 → forwardedCount=1, status stays "Ordered"
- Advance 1 → forwardedCount=2, status stays "Ordered"
- Advance 1 → forwardedCount=3 → status becomes "In Lab", forwardedCount reset to 0

### 4.5 Classification System

Each order has three classification fields:

| Field | Purpose | Values |
|-------|---------|--------|
| `classification` | Legacy overall order classification | pending, stock, buy, order |
| `rightLensStatus` | Per-eye classification for right lens | pending, stock, buy, order |
| `leftLensStatus` | Per-eye classification for left lens | pending, stock, buy, order |

**Classification values:**
- `pending`: Not yet classified, needs review
- `stock`: Lens/frame available in inventory
- `buy`: Need to purchase from supplier (→ demand list)
- `order`: Need to send to lab for manufacturing (→ demand list)

### 4.6 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-O01 | Status transitions are validated against VALID_TRANSITIONS | `orders.ts:177-183` |
| BR-O02 | Setting status to "Delivered" records actualDeliveryDate | `orders.ts:193` |
| BR-O03 | Setting status to "Ready" auto-sends WhatsApp notification | `orders.ts:219-231` |
| BR-O04 | Setting status to "Delivered" auto-sends WhatsApp notification | `orders.ts:235-243` |
| BR-O05 | Collecting payment on delivery auto-creates Payment record | `orders.ts:247-272` |
| BR-O06 | Order GET returns billInfo (latest bill for customer) | `orders.ts:91-98` |
| BR-O07 | Demand list generation creates per-eye PDF entries | `orders.ts:458-516` |
| BR-O08 | Demand list supports "buy" (supplier) and "order" (lab) types | `orders.ts:408-410` |
| BR-O09 | Orders support Zod validation on create and update | `orders.ts:30-57` |

### 4.7 Demand List PDF Generation

When generating demand lists, the system:

1. Finds orders where `rightLensStatus === type` OR `leftLensStatus === type` OR legacy `classification === type`
2. Populates prescriptions from visit links
3. Creates per-eye entries with customer name, lens details, coating, and formatted prescription
4. Generates a styled PDF using PDFKit with columns: #, Eye (R/L), Customer, Lens, Coating, Prescription
5. Sends PDF via WhatsApp to shop owner (fire-and-forget)

### 4.8 Common Scenarios

**Scenario: Order placed via Workspace**
1. Customer comes in for new glasses
2. Staff opens Workspace
3. Creates customer → visit → prescription → order (with frame + lens + coating details)
4. Bill generated with line items
5. Payment recorded (full or partial)
6. Delivery date set
7. All entities created atomically via `POST /api/workspace/transaction`

**Scenario: Lab order ready**
1. Lab completes lens grinding
2. Staff updates order status: "In Lab" → "Ready"
3. System auto-sends WhatsApp: "Your order is ready for pickup!"
4. Delivery record updated to "Ready" status

---

## 5. Billing Domain

### 5.1 Domain Overview

The Billing domain handles invoice generation, line items, totals calculation, discounts, taxes, and tracking of paid vs pending amounts. Bills link to customers and optionally to visits. Bills generate WhatsApp notifications with PDF attachments.

**Implementation files:**
- Model: `server/src/models/bill.ts`
- Routes: `server/src/routes/bills.ts`
- PDF generation: `server/src/utils/pdf.ts`
- Frontend: `client/src/pages/Bills.tsx`, `client/src/components/NewvistePage/BillingPanel.tsx`

### 5.2 Data Model

```
BillItem {
  description: String (required)
  quantity: Number (default: 1)
  unitPrice: Number (default: 0)
  total: Number (default: 0)          // Computed: quantity × unitPrice
}

Bill {
  _id: ObjectId (auto)
  billNumber: String (unique, indexed)  // "BILL-{timestamp}"
  customerId: ObjectId → Customer (required, indexed)
  visitId: ObjectId → Visit (optional)
  items: BillItem[] (default: [])
  subtotal: Number (default: 0)
  discount: Number (default: 0)
  tax: Number (default: 0)
  advancePaid: Number (default: 0)      // Total payments received
  pendingAmount: Number (default: 0)    // Outstanding balance
  totalAmount: Number (default: 0)      // Final total
  status: Enum ["Active" | "Cancelled"] default: "Active"
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 5.3 Calculation Formulas

```
subtotal = sum(item.quantity × item.unitPrice) for all items
totalAmount = subtotal - discount + tax
pendingAmount = max(0, totalAmount - advancePaid)
```

### 5.4 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-B01 | Bill number is auto-generated: `BILL-{timestamp}` | `bills.ts:52` |
| BR-B02 | subtotal is computed from items array | `bills.ts:53` |
| BR-B03 | totalAmount = subtotal - discount + tax | `bills.ts:54` |
| BR-B04 | pendingAmount = max(0, totalAmount - advancePaid) | `bills.ts:55` |
| BR-B05 | Bill creation increments customer totalSpent and pendingAmount | `bills.ts:61-63` |
| BR-B06 | Bill update adjusts customer totalSpent/pendingAmount by delta | `bills.ts:132-143` |
| BR-B07 | Bill deletion reverses customer totalSpent and pendingAmount | `bills.ts:155-156` |
| BR-B08 | Bill creation fires WhatsApp PDF notification (async, non-blocking) | `bills.ts:69-95` |
| BR-B09 | Bill PDF includes shop info, customer info, line items, totals | `pdf.ts:40-212` |
| BR-B10 | pendingAmount cannot go below 0 (Math.max(0, ...)) | `bills.ts:128` |

### 5.5 Bill PDF Structure

The generated PDF includes:
1. **Header bar** — Blue background with shop name
2. **Logo** — If configured in settings
3. **Invoice badge** — "INVOICE" label
4. **Bill meta** — Bill number, date
5. **Customer info** — Name, mobile, customer ID, address
6. **Items table** — Description, Qty, Unit Price, Total columns
7. **Totals section** — Subtotal, Discount (red), Tax (green), Total (bold), Paid (green), Pending (amber)
8. **Footer** — Thank you message

### 5.6 Edge Cases

- **Bill with no items**: Valid — subtotal and total will be 0
- **Negative pendingAmount**: Prevented by Math.max(0, ...)
- **Bill update with changed items**: Subtotal and total recalculated from new items
- **WhatsApp notification failure**: Silently caught — does not affect bill creation

---

## 6. Payment Domain

### 6.1 Domain Overview

Payments track money received from customers against bills. Each payment is linked to a customer and optionally to a bill. Payments support multiple payment modes including Hindi-localized labels. The system handles partial payments, payment edits with delta tracking, and cascading updates to bill and customer records.

**Implementation files:**
- Model: `server/src/models/payment.ts`
- Routes: `server/src/routes/payments.ts`
- Frontend: `client/src/pages/Payments.tsx`, `client/src/components/NewvistePage/PaymentPanel.tsx`

### 6.2 Data Model

```
Payment {
  _id: ObjectId (auto)
  customerId: ObjectId → Customer (required)
  billId: ObjectId → Bill (optional)
  amount: Number (required, min: 0.01)
  paymentMode: Enum ["Cash" | "UPI" | "Card" | "Bank Transfer"
                     | "नकद" | "कार्ड" | "बैंक" | "बीमा" | "Insurance"]
             default: "Cash"
  paymentDate: Date (default: now)
  notes: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 6.3 Payment Modes (Bilingual)

The system supports both English and Hindi payment mode labels:

| English | Hindi | Meaning |
|---------|-------|---------|
| Cash | नकद | Cash payment |
| Card | कार्ड | Card payment (debit/credit) |
| Bank Transfer | बैंक | Bank transfer / NEFT / UPI |
| Insurance | बीमा | Insurance claim |
| UPI | — | UPI payment (Google Pay, PhonePe, etc.) |

### 6.4 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-PAY01 | Payment amount must be >= 0.01 | Zod validation: `z.number().min(0.01)` |
| BR-PAY02 | Payment creation increments bill.advancePaid | `payments.ts:49-51` |
| BR-PAY03 | Payment creation recalculates bill.pendingAmount | `payments.ts:53` |
| BR-PAY04 | Payment creation decrements customer.pendingAmount | `payments.ts:57-59` |
| BR-PAY05 | Payment update with amount change adjusts bill and customer | `payments.ts:86-96` |
| BR-PAY06 | Payment update logs amount change in notes field | `payments.ts:78-81` |
| BR-PAY07 | Payment deletion reverses bill.advancePaid | `payments.ts:113-115` |
| BR-PAY08 | Payment deletion reverses customer.pendingAmount (increments) | `payments.ts:121` |
| BR-PAY09 | Maximum 500 payments returned per query | `payments.ts:38` |

### 6.5 Payment Edit Delta Tracking

When a payment's amount is changed, the system:

1. Calculates `diff = newAmount - oldAmount`
2. Adjusts `bill.advancePaid += diff`
3. Recalculates `bill.pendingAmount = max(0, totalAmount - advancePaid)`
4. Adjusts `customer.pendingAmount -= diff`
5. Appends change note to payment notes: `"Amount changed from ₹500 to ₹700"`

### 6.6 Common Scenarios

**Scenario: Advance payment at order time**
1. Customer places order worth ₹5,000
2. Bill created with totalAmount=5000, advancePaid=1000, pendingAmount=4000
3. Customer pays ₹1,000 via UPI
4. Payment created: amount=1000, paymentMode="UPI", billId=bill._id
5. Bill updated: advancePaid=1000, pendingAmount=4000
6. Customer: pendingAmount=4000

**Scenario: Due collection on delivery**
1. Customer picks up order
2. Staff marks order as "Delivered" with collectPayment=4000
3. System auto-creates Payment record
4. Bill updated: advancePaid=5000, pendingAmount=0
5. Customer: pendingAmount=0

---

## 7. Inventory Domain

### 7.1 Domain Overview

The inventory domain manages stock of optical frames, lenses, and accessories. Each item has a unique SKU, supports dual-location tracking (shop vs warehouse), and includes QR code generation for scanning. The inventory system feeds into the order classification workflow and demand list generation.

**Implementation files:**
- Model: `server/src/models/inventory.ts`
- Routes: `server/src/routes/inventory.ts`
- Frontend: `client/src/pages/InventoryPage.tsx`, `client/src/pages/ItemScan.tsx`
- Warehouse app: `warehouse/src/pages/Inventory.tsx`

### 7.2 Data Model

```
Inventory {
  _id: ObjectId (auto)
  sku: String (unique, indexed)             // Stock Keeping Unit
  category: Enum ["Frame" | "Lens" | "Accessories"] default: "Frame"
  inventoryType: Enum ["spectacles" | "sunglasses" | "lens" | "accessory"
                       | "hearing-aid" | "cleaner" | "case" | "other"]
               default: "spectacles"
  brand: String (optional)
  model: String (optional)
  color: String (optional)
  size: String (optional)
  gender: Enum ["Male" | "Female" | "Unisex" | ""] default: ""
  supplier: String (optional)
  quantity: Number (default: 0)
  location: Enum ["shop" | "warehouse"] default: "shop"
  purchasePrice: Number (default: 0)
  sellingPrice: Number (default: 0)
  description: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 7.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-INV01 | SKU is required and must be unique | Zod: `z.string().min(1)`, MongoDB unique index |
| BR-INV02 | Quantity can be negative (allows overselling tracking) | No min constraint on quantity |
| BR-INV03 | Stock adjustment uses `$inc` for atomic operations | `inventory.ts:106` — `$inc: { quantity: qty }` |
| BR-INV04 | Search supports regex across sku, brand, model, category, supplier | `inventory.ts:58-68` |
| BR-INV05 | QR code generation from SKU | `inventory.ts:86-93` — `QRCode.toBuffer(item.sku)` |
| BR-INV06 | SKU lookup by code (for scanner) | `inventory.ts:79-83` — `findOne({ sku: code })` |
| BR-INV07 | Low stock threshold: quantity <= 5 | `dashboard.ts:103` — `Inventory.countDocuments({ quantity: { $lte: 5 } })` |
| BR-INV08 | Total inventory value = sum(purchasePrice × quantity) | `inventory.ts:39-42` — MongoDB aggregation |
| BR-INV09 | Allowed update fields are whitelisted | `inventory.ts:116` — explicit `allowed` array |

### 7.4 Dual Location System

Items can exist in two locations:
- **shop**: Items available for immediate sale on the shop floor
- **warehouse**: Items in storage, not immediately available for customer trial

The dashboard tracks warehouse items separately:
```
dashboard.ts:147-156:
  Stock map tracks { shop: number, warehouse: number } per brand
  Used for incomplete orders to show stock availability
```

### 7.5 Inventory in Order Workflow

When orders are fetched, the system cross-references inventory by brand:
```
dashboard.ts:144-168:
  1. Find all active orders (Draft, Ordered, In Lab)
  2. Extract unique lens and frame brands
  3. Query inventory for matching brands
  4. Build stockMap with shop/warehouse quantities per brand
  5. Attach stockStatus to each order for frontend display
```

---

## 8. Delivery Domain

### 8.1 Domain Overview

Delivery tracking monitors the physical fulfillment of orders. Each delivery links to a customer and an order, with status tracking from pending to delivered. Delivery status is auto-updated when order status changes.

**Implementation files:**
- Model: `server/src/models/delivery.ts`
- Routes: `server/src/routes/delivery.ts`
- Frontend: `client/src/pages/Delivery.tsx`, `client/src/pages/Pickup.tsx`

### 8.2 Data Model

```
Delivery {
  _id: ObjectId (auto)
  customerId: ObjectId → Customer (required, indexed)
  orderId: ObjectId → Order (optional, indexed)
  address: String (optional)
  expectedDeliveryDate: Date (optional)
  actualDeliveryDate: Date (optional)
  status: Enum ["Pending" | "In Transit" | "Ready" | "Delivered" | "Cancelled"]
         default: "Pending"
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 8.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-D01 | Delivery status auto-updates when order status changes | `orders.ts:202-216` |
| BR-D02 | Order status "Ready" → Delivery status "Ready" | `orders.ts:204-206` |
| BR-D03 | Order status "Delivered" → Delivery status "Delivered" + records actualDeliveryDate | `orders.ts:207-210` |
| BR-D04 | Order status "Cancelled" → Delivery status "Cancelled" | `orders.ts:211-213` |
| BR-D05 | Delivery auto-update only on full quantity advancement | `orders.ts:203` — `if (newForwarded >= qty)` |
| BR-D06 | Dashboard shows today's deliveries + pending/ready deliveries | `dashboard.ts:119-127` |
| BR-D07 | Reports track overdue deliveries | `reports.ts:128` — `expectedDeliveryDate < today && status != Delivered` |

### 8.4 Delivery Status Flow

```
Pending → In Transit → Ready → Delivered
   └──────────────────────────→ Cancelled
```

### 8.5 Pickup Page

The Pickup page (`client/src/pages/Pickup.tsx`) provides a customer-facing view:
- Shows orders ready for pickup
- Customer can search by name/mobile
- Staff can mark as collected (triggers "Delivered" status)

---

## 9. WhatsApp Integration

### 9.1 Domain Overview

WhatsApp integration uses the Baileys library (WhatsApp Web reverse-engineering) to send notifications, bills, demand lists, and broadcast messages. The system supports per-branch WhatsApp instances, message queuing for offline scenarios, media sending (PDF, images), and broadcast with anti-ban throttling.

**Implementation files:**
- Service: `server/src/services/whatsapp.ts` (640 lines — second largest file)
- Routes: `server/src/routes/whatsapp.ts`
- Phone utils: `server/src/utils/phone.ts`
- Frontend: `client/src/pages/WhatsApp.tsx`

### 9.2 Architecture

```
WhatsAppManager (singleton)
  ├── defaultInstance: WhatsAppService (legacy, no branch)
  └── instances: Map<branchId, WhatsAppService>
        ├── branch_1: WhatsAppService
        ├── branch_2: WhatsAppService
        └── ...
```

Each `WhatsAppService` instance:
- Maintains its own Baileys socket connection
- Stores auth state in MongoDB collection `baileys_auth_{branchId}`
- Has independent message queue
- Handles reconnection with exponential backoff

### 9.3 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-WA01 | Phone numbers normalized to Indian format (91 prefix) | `phone.ts:1-8` |
| BR-WA02 | WhatsApp JID format: `{normalizedPhone}@s.whatsapp.net` | `phone.ts:10-12` |
| BR-WA03 | Messages queued when offline, drained on reconnect | `whatsapp.ts:329-364` |
| BR-WA04 | Bill creation sends PDF via WhatsApp (fire-and-forget) | `bills.ts:69-95` |
| BR-WA05 | Order "Ready" status sends pickup notification | `orders.ts:219-231` |
| BR-WA06 | Order "Delivered" status sends delivery confirmation | `orders.ts:235-243` |
| BR-WA07 | Broadcast supports anti-ban throttling (configurable delay, batch pause) | `whatsapp.ts:425-474` |
| BR-WA08 | QR timeout: 120 seconds | `whatsapp.ts:95` — `QR_TIMEOUT_MS = 120000` |
| BR-WA09 | Max reconnect attempts: 5 with exponential backoff | `whatsapp.ts:96-97` |
| BR-WA10 | Auth state persisted in MongoDB (survives server restarts) | `whatsapp.ts:34-90` |

### 9.4 WhatsApp Status Flow

```
initializing → qr (QR code shown) → connected
                ↘ pairing (pairing code) → connected
    ↓ (timeout)
   error

connected → (disconnect) → reconnecting → connected
    ↓ (logout/bad session)
   error (needs re-auth)
```

### 9.5 Message Types

| Type | Trigger | Content |
|------|---------|---------|
| Bill PDF | Bill creation | PDF attachment + "Your bill {billNumber} has been generated!" |
| Order Ready | Order status → Ready | "Your order is ready for pickup!" with items and date |
| Order Delivered | Order status → Delivered | "Your order has been delivered!" |
| Demand List PDF | Manual trigger | Purchase list or Lab order list PDF |
| Broadcast | Manual trigger | Custom message to multiple contacts |
| Manual Send | Manual trigger | Custom text/media to single contact |

### 9.6 Phone Number Normalization

```
Input          → Normalized    → WhatsApp JID
"9876543210"   → "919876543210" → "919876543210@s.whatsapp.net"
"09876543210"  → "919876543210" → "919876543210@s.whatsapp.net"
"+919876543210"→ "919876543210" → "919876543210@s.whatsapp.net"
```

---

## 10. Multi-Branch Domain

### 10.1 Domain Overview

The system supports multi-branch operation where each branch has its own isolated MongoDB database. Branches are managed centrally (in the main database) but branch-scoped data lives in separate databases. Users are assigned to branches and can only access their assigned branch's data.

**Implementation files:**
- Branch model: `server/src/models/branch.ts`
- Branch routes: `server/src/routes/branches.ts`
- Branch proxy: `server/src/utils/branchProxy.ts`
- Branch middleware: `server/src/middleware/branch.ts`
- Database manager: `server/src/models/db.ts`
- Request context: `server/src/utils/requestContext.ts`

### 10.2 Data Model

```
Branch {
  _id: ObjectId (auto)
  name: String (required)           // "Govindpuri"
  code: String (required, unique)   // "GVP"
  address: String (optional)
  phone: String (optional)
  email: String (optional)
  dbName: String (required)         // "kmj_govindpuri"
  isActive: Boolean (default: true)
  settings: {
    shopName: String
    shopAddress: String
    shopPhone: String
    shopEmail: String
    adminWhatsApp: String
    logo: String
  }
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 10.3 Branch Isolation Mechanism

```
Request Flow:
1. Client sends X-Branch-ID header
2. branchScope middleware intercepts
3. Looks up Branch by ID
4. Calls getBranchModels(branch.dbName)
5. getBranchModels uses mongoose.connection.useDb(dbName)
6. Returns branch-scoped Mongoose models
7. AsyncLocalStorage stores RequestContext
8. withBranch Proxy intercepts model calls
9. Routes use proxied models (transparent branch switching)
```

**Key files:**
- `middleware/branch.ts:14-41` — `branchScope` middleware
- `models/db.ts:62-69` — `getBranchModels` with connection caching
- `utils/branchProxy.ts:4-29` — `withBranch` Proxy for transparent model switching
- `utils/requestContext.ts:1-20` — AsyncLocalStorage for request-scoped context

### 10.4 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-BR01 | Branch code must be unique and uppercase | `branches.ts:33-36` — `toUpperCase()` |
| BR-BR02 | Branch dbName must be unique | `branches.ts:33-36` — uniqueness check |
| BR-BR03 | Deactivating a branch sets isActive=false (soft delete) | `branches.ts:72-79` |
| BR-BR04 | Active branch list excludes inactive branches | `branches.ts:10-13` |
| BR-BR05 | Branch-scoped routes use branchScope middleware | `routes/index.ts:26-39` |
| BR-BR06 | Branch connection cache avoids reconnecting | `db.ts:62-69` — `branchModelCache` |
| BR-BR07 | Clearing branch cache invalidates all cached models | `db.ts:71-73` |
| BR-BR08 | Owner sees all branches; staff sees assigned branches | `authController.ts:12-27` |
| BR-BR09 | Default branch seeded on first run if none exist | `index.ts:92-127` |

### 10.5 Branch Data Migration

When a new branch is created and data exists in the main database, the system automatically migrates collections:
```
index.ts:106-117:
  Collections migrated: customers, visits, prescriptions, orders,
                        bills, payments, inventory, deliveries,
                        settings, todos
  Only migrates if source has data and target is empty
```

### 10.6 User-Branch Assignment

| Role | Branch Access |
|------|---------------|
| owner | All active branches |
| staff | Assigned branches only (typically 1) |
| warehouse | No branch assignment (cross-branch inventory) |

---

## 11. Authentication & Authorization

### 11.1 Domain Overview

The system uses JWT-based authentication with access and refresh tokens. Three user roles exist: owner, staff, and warehouse. Role-based access control (RBAC) restricts certain pages and operations.

**Implementation files:**
- User model: `server/src/models/user.ts`
- Auth controller: `server/src/controllers/authController.ts`
- Auth routes: `server/src/routes/auth.ts`
- JWT utils: `server/src/utils/jwt.ts`
- Auth middleware: `server/src/middleware/auth.ts`
- Frontend auth: `client/src/context/AuthContext.tsx`
- Frontend guards: `client/src/components/RoleGuard.tsx`

### 11.2 User Data Model

```
User {
  _id: ObjectId (auto)
  username: String (required, unique)
  passwordHash: String (required)
  name: String (default: "")
  mobile: String (default: "")
  role: Enum ["owner" | "staff" | "warehouse"] default: "owner"
  branches: ObjectId[] → Branch
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

### 11.3 Authentication Flow

```
Login:
1. POST /api/auth/login { username, password, branchId }
2. Find user by username
3. Validate role (staff must use staff-login)
4. Compare password with bcrypt hash
5. Generate access token (24h) + refresh token (7d)
6. Return user data + tokens + selected branchId

Staff Login:
1. POST /api/auth/staff-login { username, password }
2. Find user, validate role=staff
3. Auto-detect branch from user.branches[0]
4. Return user + tokens + branchId

Refresh:
1. POST /api/auth/refresh { refresh }
2. Verify refresh token JWT
3. Generate new access token
4. Return new access token
```

### 11.4 Business Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| BR-AUTH01 | Access token expires in 24 hours | `config.ts:8` |
| BR-AUTH02 | Refresh token expires in 7 days | `config.ts:9` |
| BR-AUTH03 | Only owner can create new users | `authController.ts:31-33` |
| BR-AUTH04 | Staff cannot use admin login endpoint | `authController.ts:103-105` |
| BR-AUTH05 | Admins cannot use staff login endpoint | `authController.ts:128-130` |
| BR-AUTH06 | Warehouse login restricted to warehouse/owner roles | `authController.ts:57-63` |
| BR-AUTH07 | Cannot delete owner account | `authController.ts:237` |
| BR-AUTH08 | Cannot delete yourself | `authController.ts:238` |
| BR-AUTH09 | Warehouse users can only delete warehouse accounts | `authController.ts:234-235` |
| BR-AUTH10 | Default users seeded: admin/admin123, warehouse/admin123 | `index.ts:78-89` |
| BR-AUTH11 | Rate limiting: 200 requests/minute | `app.ts:30-37` |
| BR-AUTH12 | bcrypt salt rounds: 10 | `authController.ts:43` |

### 11.5 Role-Based Page Access

| Page | owner | staff | warehouse |
|------|-------|-------|-----------|
| Dashboard | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ❌ |
| Orders | ✅ | ✅ | ❌ |
| Bills | ✅ | ✅ | ❌ |
| Payments | ✅ | ✅ | ❌ |
| Inventory | ✅ | ✅ | ✅ |
| Delivery | ✅ | ✅ | ❌ |
| Reports | ✅ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ |
| WhatsApp | ✅ | ✅ | ❌ |

---

## 12. Todo / Task Domain

### 12.1 Domain Overview

Simple task management for shop operations. Todos are branch-scoped and can be marked complete.

**Implementation files:**
- Model: `server/src/models/todo.ts`
- Controller: `server/src/controllers/todoController.ts`
- Routes: `server/src/routes/todos.ts`

### 12.2 Data Model

```
Todo {
  _id: ObjectId (auto)
  task: String (required)
  done: Boolean (default: false)
  notes: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

---

## Cross-Domain Relationships

```
Customer ──┬── Visit ──┬── Prescription
            │           └── Order ──── Delivery
            ├── Bill ──── Payment
            └── Todo (standalone)

All entities reference Customer by customerId
Visit links to Customer
Prescription links to Customer + Visit
Order links to Customer + Visit
Bill links to Customer + Visit
Payment links to Customer + Bill
Delivery links to Customer + Order
```

---

## AI Instructions for Using This Knowledge

When working with this codebase:

1. **Always check denormalized fields**: Customer.totalVisits, Customer.totalSpent, Customer.pendingAmount are maintained across multiple route files. Any new mutation touching these domains must update the denormalized counters.

2. **Branch isolation is transparent**: Models are proxied via `withBranch()`. Never import models directly from model files in routes — use the proxied versions. The `branchScope` middleware handles this automatically.

3. **Cache invalidation is mandatory**: Any mutation must call `invalidateCache()` for the affected route AND `/api/dashboard` (dashboard aggregates everything).

4. **WhatsApp is fire-and-forget**: All WhatsApp calls are wrapped in try/catch and should never block or fail the main operation.

5. **Status transitions are state-machine controlled**: Never set order status directly. Always use the PATCH /:id/status endpoint which validates transitions.

6. **Workspace transaction is atomic but not wrapped in MongoDB transaction**: The workspace endpoint creates multiple entities sequentially. If one fails, previously created entities remain (no rollback).

7. **PDF generation is server-side**: All PDFs (bills, demand lists) use PDFKit on the server, not client-side generation.

8. **Hindi payment modes are aliases**: "नकद" = "Cash", "कार्ड" = "Card", "बैंक" = "Bank Transfer", "बीमा" = "Insurance". Treat them as equivalent.
