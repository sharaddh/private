# 18 - Input Validation

## Purpose

This document defines input validation patterns for the KMJ Optical ERP, including Zod schemas, manual validation, request body validation, query parameter validation, route parameter validation, and sanitization.

## Validation Strategy

### Validation Layers

```
1. Client-Side Validation (React forms)
   └── Immediate user feedback

2. API-Level Validation (Zod schemas)
   └── Schema validation on request body

3. Controller-Level Validation (Manual checks)
   └── Business logic validation

4. Database-Level Validation (Mongoose schema)
   └── Final data integrity check
```

### Validation Rules

1. **Always validate server-side** - never trust client validation
2. **Always use Zod** for request body validation
3. **Always validate required fields** before processing
4. **Always sanitize inputs** before database operations
5. **Always return clear error messages** for validation failures
6. **Never skip validation** without good reason

## Zod Schema Validation

### Schema Definition

```typescript
import { z } from "zod";

// Customer creation schema
const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
  email: z.string().email().optional(),
  age: z.number().min(0).max(150).optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Order creation schema
const createOrderSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  lens: z.string().optional(),
  coating: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional(),
});

// Bill creation schema
const createBillSchema = z.object({
  customerId: z.string(),
  visitId: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
  })).optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  advancePaid: z.number().optional(),
});

// Payment creation schema
const createPaymentSchema = z.object({
  customerId: z.string(),
  billId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be positive"),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

// Status update schema
const statusUpdateSchema = z.object({
  status: z.string(),
  collectPayment: z.number().optional(),
  paymentMode: z.enum([
    "Cash", "UPI", "Card", "Bank Transfer",
    "नकद", "कार्ड", "बैंक", "बीमा", "Insurance"
  ]).optional(),
  advanceQuantity: z.number().optional(),
});
```

### Schema Validation in Routes

```typescript
// Using .parse() (throws on error)
router.post("/", authenticate, audit, asyncHandler(async (req, res) => {
  const p = createOrderSchema.parse(req.body);
  // p is type-safe
  const order = new Order(p as any);
  await order.save();
  res.json({ success: true, data: order });
}));

// Using .safeParse() (returns result object)
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json(fail(parsed.error.issues));
  }
  const customer = await Customer.create(parsed.data);
  res.json(created(customer));
}));
```

### Schema Rules

1. **Always define schemas** for request bodies
2. **Always use `.parse()` or `.safeParse()`** before processing
3. **Always provide descriptive error messages**
4. **Always use appropriate types** (string, number, boolean, array)
5. **Always use `.optional()`** for non-required fields
6. **Always use `.min()` and `.max()`** for string/number bounds
7. **Always use `.email()`** for email validation
8. **Always use `.enum()`** for fixed set of values

## Manual Validation

### Required Field Checks

```typescript
// In controller
export async function create(req: Request, res: Response) {
  const { name, mobile } = req.body;
  if (!name?.trim()) throw new AppError(400, "Name is required");
  if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
  // ...
}
```

### Business Logic Validation

```typescript
// Order status transition validation
const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Ordered", "Cancelled"],
  Ordered: ["In Lab", "Cancelled"],
  "In Lab": ["Ready", "Cancelled"],
  Ready: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

router.patch("/:id/status", authenticate, async (req, res) => {
  const { status } = statusUpdateSchema.parse(req.body);
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
    });
  }
  // ...
});
```

### Classification Validation

```typescript
router.patch("/:id/classify", authenticate, asyncHandler(async (req, res) => {
  const { classification } = req.body;
  if (!["pending", "stock", "buy", "order"].includes(classification)) {
    return res.status(400).json({ success: false, message: "Invalid classification" });
  }
  // ...
}));
```

### Eye Classification Validation

```typescript
router.patch("/:id/classify-eye", authenticate, asyncHandler(async (req, res) => {
  const { eye, status } = req.body;
  if (!["right", "left"].includes(eye)) {
    return res.status(400).json({ success: false, message: 'eye must be "right" or "left"' });
  }
  if (!["pending", "stock", "buy", "order"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }
  // ...
}));
```

## Query Parameter Validation

### Pagination Parameters

```typescript
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 1000;
```

### Date Range Parameters

```typescript
if (startDate || endDate) {
  filter.createdAt = {};
  if (startDate) {
    const s = new Date(startDate as string);
    if (isNaN(s.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid startDate" });
    }
    s.setHours(0, 0, 0, 0);
    filter.createdAt.$gte = s;
  }
  if (endDate) {
    const e = new Date(endDate as string);
    if (isNaN(e.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid endDate" });
    }
    e.setHours(23, 59, 59, 999);
    filter.createdAt.$lte = e;
  }
}
```

### Filter Parameters

```typescript
// customerId filter
if (customerId) {
  if (!mongoose.Types.ObjectId.isValid(customerId as string)) {
    return res.status(400).json({ success: false, message: "Invalid customerId" });
  }
  filter.customerId = customerId;
}

// status filter
if (status) {
  const validStatuses = ["Draft", "Ordered", "In Lab", "Ready", "Delivered", "Cancelled"];
  if (!validStatuses.includes(status as string)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }
  filter.status = status;
}
```

## Route Parameter Validation

### ObjectId Validation

```typescript
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid ID format" });
  }
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}));
```

### Mongoose CastError Handling

```typescript
// In errorHandler middleware
if (err.name === "CastError") {
  return res.status(400).json({
    success: false,
    message: "Invalid ID format",
  });
}
```

## Input Sanitization

### String Trimming

```typescript
// Trim whitespace from strings
const name = req.body.name?.trim();
const mobile = req.body.mobile?.trim();
```

### Phone Number Normalization

```typescript
// server/src/utils/phone.ts
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits;
  return digits;
}
```

### Regex Escaping

```typescript
// server/src/routes/inventory.ts
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Usage in search
const filter = q
  ? {
      $or: [
        { sku: { $regex: escapeRegex(q), $options: "i" } },
        { brand: { $regex: escapeRegex(q), $options: "i" } },
      ],
    }
  : {};
```

### HTML Sanitization

```typescript
// Prevent XSS in user-generated content
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

## Validation Error Responses

### Zod Validation Errors

```typescript
// Using safeParse
const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    success: false,
    message: parsed.error.issues,
  });
}
```

### Manual Validation Errors

```typescript
// Using AppError
if (!name?.trim()) {
  throw new AppError(400, "Name is required");
}

// Using direct response
if (!["pending", "stock", "buy", "order"].includes(classification)) {
  return res.status(400).json({ success: false, message: "Invalid classification" });
}
```

### Error Response Format

```typescript
// Zod errors
{
  "success": false,
  "message": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["name"],
      "message": "Required"
    }
  ]
}

// Manual errors
{
  "success": false,
  "message": "Name is required"
}
```

## Workspace Transaction Validation

### Complex Nested Schema

```typescript
const transactionSchema = z.object({
  customerId: z.string().optional(),
  customer: z.object({
    _id: z.string().optional(),
    name: z.string().optional(),
    mobile: z.string().optional(),
    email: z.string().optional(),
    age: z.number().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  visit: z.object({
    visitDate: z.string().optional(),
    visitType: z.string().optional(),
    doctorName: z.string().optional(),
    shop: z.string().optional(),
    remarks: z.string().optional(),
  }).optional(),
  prescription: z.record(z.string(), z.unknown()).optional(),
  order: z.record(z.string(), z.unknown()).optional(),
  bill: z.object({
    items: z.array(z.unknown()).optional(),
    subtotal: z.number().optional(),
    discount: z.number().optional(),
    totalAmount: z.number().optional(),
  }).optional(),
  payment: z.object({
    amount: z.number().min(0).optional(),
    mode: z.string().optional(),
    paymentMode: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  delivery: z.object({
    address: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }).optional(),
});
```

## Bad Examples

```typescript
// BAD: No validation
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body); // No validation!
}));

// BAD: Client-side only validation
<input type="text" required /> // No server validation

// BAD: Trusting user input
const role = req.body.role; // User could set themselves as owner

// BAD: No regex escaping
const filter = { name: { $regex: search, $options: "i" } }; // ReDoS vulnerability

// BAD: Unclear error messages
return res.status(400).json({ success: false, message: "Error" });
```

## Good Examples

```typescript
// GOOD: Zod validation
const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
});

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const parsed = createSchema.parse(req.body);
  const customer = await Customer.create(parsed.data);
  res.json(created(customer));
}));

// GOOD: Manual validation
export async function create(req: Request, res: Response) {
  const { name, mobile } = req.body;
  if (!name?.trim()) throw new AppError(400, "Name is required");
  if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
  // ...
}

// GOOD: Regex escaping
const filter = { name: { $regex: escapeRegex(search), $options: "i" } };

// GOOD: Clear error messages
return res.status(400).json({
  success: false,
  message: `Cannot transition from "${order.status}" to "${status}"`,
});
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Zod for body validation | Type-safe, descriptive errors | Schema maintenance |
| Manual checks for business logic | Flexible, expressive | Scattered validation |
| Regex search | Flexible text matching | ReDoS risk if not escaped |
| No HTML sanitization | Simpler implementation | XSS vulnerability |
| Lenient validation | Better UX | Potentially invalid data |

## Cross-References

- **API design**: See `docs/14-api-design.md`
- **Error handling**: See `docs/19-error-handling.md`
- **Security**: See `docs/22-security.md`
- **Backend patterns**: See `docs/07-backend.md`

## AI Instructions

When working on validation code:
1. Always use Zod for request body validation
2. Always validate required fields
3. Always escape regex in search queries
4. Always provide clear error messages
5. Always validate server-side (never trust client)
6. Always sanitize user input
7. Never skip validation without good reason
8. Always run linting after changes
