# 26 - Event-Driven Design

## Purpose

This document defines event-driven patterns, event emitters, webhook patterns, cache invalidation events, audit events, and WhatsApp notification events for the KMJ Optical ERP system. Every asynchronous, decoupled, or notification-driven interaction must follow these guidelines.

## Core Principles

1. **Decoupling**: Events decouple producers from consumers. A service emitting an event should not know who consumes it.
2. **Idempotency**: Event handlers must be idempotent. Processing the same event twice should produce the same result.
3. **Failure Isolation**: A failing event handler must never block the event producer.
4. **Auditability**: All state-changing business events must be loggable for audit trails.
5. **Branch Isolation**: Events must carry branch context (`branchId`, `dbName`) and be scoped to the correct database.

## Detailed Rules

### Event Emitter Pattern

The KMJ backend uses the Node.js `EventEmitter` for in-process event dispatching. Events are emitted synchronously but handlers must delegate async work to background jobs or fire-and-forget promises.

**Rules**:
1. Always define a typed event map (no stringly-typed events).
2. Always pass a payload interface with each event.
3. Always handle errors inside event handlers; never let exceptions propagate to the emitter.
4. Always include `branchId` and `userId` in event payloads for audit traceability.
5. Never use `EventEmitter` for cross-service communication (use message queues for that).

```typescript
// GOOD: Typed event emitter
import { EventEmitter } from 'events';

interface DomainEvents {
  'order:created': { orderId: string; customerId: string; branchId: string; userId: string };
  'order:statusChanged': { orderId: string; oldStatus: string; newStatus: string; branchId: string; userId: string };
  'bill:created': { billId: string; customerId: string; branchId: string; totalAmount: number };
  'payment:received': { paymentId: string; billId: string; amount: number; branchId: string };
  'customer:created': { customerId: string; name: string; mobile: string; branchId: string };
  'inventory:low': { itemId: string; sku: string; currentStock: number; branchId: string };
  'delivery:scheduled': { deliveryId: string; orderId: string; branchId: string };
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof DomainEvents>(event: K, handler: (payload: DomainEvents[K]) => void): this {
    return super.on(event, handler);
  }
}

export const domainEvents = new TypedEventEmitter();
```

```typescript
// BAD: Untyped string events
const emitter = new EventEmitter();
emitter.emit('order_created', data);       // typo-prone
emitter.emit('ORDER_CREATED', data);        // inconsistent casing
emitter.emit('order:created');              // missing payload
```

### Webhook Patterns

Webhooks are used to notify external systems (lab partners, warehouse) about state changes. They are NOT used for internal event dispatching.

**Rules**:
1. Always sign webhook payloads with HMAC-SHA256.
2. Always include a timestamp and nonce to prevent replay attacks.
3. Always retry failed webhooks with exponential backoff (max 3 retries).
4. Always log webhook attempts (success and failure) for audit.
5. Never send sensitive data (passwords, tokens) in webhook payloads.
6. Always validate webhook responses from external systems.

```typescript
// GOOD: Signed webhook delivery
import crypto from 'crypto';

async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
  secret: string
): Promise<void> {
  const timestamp = Date.now();
  const body = JSON.stringify({ ...payload, timestamp });
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp.toString(),
    },
    body,
  });
}
```

### WhatsApp Notification Events

WhatsApp messages are dispatched via Baileys. The event system decouples business logic from message formatting and delivery.

**Rules**:
1. Always queue WhatsApp messages instead of sending synchronously in route handlers.
2. Always include retry logic for failed message deliveries.
3. Always log message delivery status (sent, delivered, failed).
4. Always respect rate limits (WhatsApp limits messages per minute).
5. Never block API responses on WhatsApp delivery.
6. Always scope WhatsApp messages to the correct branch socket.

```typescript
// GOOD: Non-blocking WhatsApp event handler
domainEvents.on('bill:created', async (payload) => {
  // Fire-and-forget: don't await in the route handler
  queueWhatsAppMessage({
    type: 'bill',
    branchId: payload.branchId,
    customerId: payload.customerId,
    billId: payload.billId,
    totalAmount: payload.totalAmount,
  }).catch((err) => {
    console.error('WhatsApp bill notification failed:', err);
  });
});

// GOOD: Route handler does NOT await WhatsApp
router.post('/bills', authenticate, branchScope, asyncHandler(async (req, res) => {
  const bill = await createBill(req.body);
  domainEvents.emit('bill:created', {
    billId: bill._id.toString(),
    customerId: bill.customerId.toString(),
    branchId: req.branchId,
    totalAmount: bill.totalAmount,
  });
  res.json(created(bill)); // Response sent immediately
}));
```

```typescript
// BAD: Blocking WhatsApp in route handler
router.post('/bills', authenticate, branchScope, asyncHandler(async (req, res) => {
  const bill = await createBill(req.body);
  await sendWhatsAppBill(bill); // Blocks response!
  res.json(created(bill));
}));
```

### Cache Invalidation Events

Cache invalidation must be event-driven to ensure consistency between Redis cache and MongoDB.

**Rules**:
1. Always emit cache invalidation events on mutations.
2. Always invalidate by pattern prefix (e.g., `customers:*`, `orders:*`).
3. Always handle cache invalidation failures gracefully (log and continue).
4. Always use branch-aware cache keys.
5. Never assume cache is consistent; always have a fallback to database.

```typescript
// GOOD: Event-driven cache invalidation
domainEvents.on('customer:created', async (payload) => {
  await cacheService.invalidate(`customers:${payload.branchId}:*`);
  await cacheService.invalidate(`dashboard:${payload.branchId}:*`);
});

domainEvents.on('order:statusChanged', async (payload) => {
  await cacheService.invalidate(`orders:${payload.branchId}:*`);
  await cacheService.invalidate(`dashboard:${payload.branchId}:*`);
  await cacheService.invalidate(`inventory:${payload.branchId}:*`);
});
```

### Audit Events

All state-changing business operations must emit audit events.

**Rules**:
1. Always capture: who (userId), what (action), when (timestamp), where (branchId), which (entityId).
2. Always store audit logs in a dedicated collection per branch.
3. Never log sensitive data (passwords, tokens, payment card details).
4. Always make audit logs immutable (append-only).
5. Always include the before/after state for data mutations.

```typescript
// GOOD: Audit event structure
interface AuditEvent {
  userId: string;
  username: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  entity: string;          // e.g., 'customer', 'order', 'bill'
  entityId: string;
  branchId: string;
  timestamp: Date;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  metadata?: Record<string, unknown>;
}

// Emit audit event
domainEvents.on('order:statusChanged', async (payload) => {
  await AuditLog.create({
    userId: payload.userId,
    action: 'update',
    entity: 'order',
    entityId: payload.orderId,
    branchId: payload.branchId,
    timestamp: new Date(),
    changes: [
      { field: 'status', oldValue: payload.oldStatus, newValue: payload.newStatus },
    ],
  });
});
```

## Examples

### Complete Event Flow for Order Creation

```
1. User creates order via POST /api/orders
2. Route handler validates input with Zod
3. Order is saved to MongoDB
4. domainEvents.emit('order:created', payload) fires
5. Event handlers run (non-blocking):
   a. Audit log handler → writes audit record
   b. Cache invalidation handler → clears order cache
   c. WhatsApp handler → queues notification to customer
   d. Dashboard handler → marks dashboard cache stale
6. Route handler returns response immediately
```

## Bad Examples

```typescript
// BAD: No event system, tight coupling
async function createOrder(orderData: CreateOrderInput, req: Request) {
  const order = await Order.create(orderData);

  // All these are tightly coupled to the order creation
  await AuditLog.create({ ... });
  await redis.del(`orders:${req.branchId}:*`);
  await sendWhatsAppMessage(order.customerId, 'Your order is created');
  await redis.del(`dashboard:${req.branchId}:*`);
  await updateCustomerStats(order.customerId);

  return order; // Slow because of all the awaits
}
```

```typescript
// BAD: Event handler throws, crashing the emitter
domainEvents.on('order:created', async (payload) => {
  const result = await sendWhatsAppMessage(payload.customerId, 'Order created');
  if (!result.ok) {
    throw new Error('WhatsApp failed'); // This crashes other handlers!
  }
});
```

## Good Examples

```typescript
// GOOD: Decoupled, error-isolated event handling
domainEvents.on('order:created', async (payload) => {
  try {
    await AuditLog.create({
      userId: payload.userId,
      action: 'create',
      entity: 'order',
      entityId: payload.orderId,
      branchId: payload.branchId,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Audit log failed for order:created:', err);
  }
});

domainEvents.on('order:created', async (payload) => {
  try {
    await cacheService.invalidate(`orders:${payload.branchId}:*`);
  } catch (err) {
    console.error('Cache invalidation failed for order:created:', err);
  }
});

domainEvents.on('order:created', async (payload) => {
  try {
    await queueWhatsAppMessage({
      type: 'order_created',
      branchId: payload.branchId,
      customerId: payload.customerId,
      orderId: payload.orderId,
    });
  } catch (err) {
    console.error('WhatsApp queue failed for order:created:', err);
  }
});
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Typed event emitter | Type safety, IDE autocomplete | More boilerplate |
| Fire-and-forget async handlers | Fast API responses | Events may be lost on crash |
| Separate handler per concern | Error isolation, testability | More functions to maintain |
| Audit events on every mutation | Complete audit trail | Write overhead |
| WhatsApp via event queue | Non-blocking, retryable | Eventual consistency |

## Cross-References

- **Backend patterns**: See `docs/07-backend.md`
- **Caching**: See `docs/24-caching.md`
- **WhatsApp integration**: See `knowledge/feature-map.md`
- **Audit logging**: See `docs/22-security.md`
- **Background jobs**: See `docs/27-background-jobs.md`

## AI Instructions

When working with events in this project:
1. Always use the typed event emitter, never raw string events
2. Always include `branchId` and `userId` in event payloads
3. Always wrap event handler logic in try/catch for error isolation
4. Never await event handlers in route handlers (fire-and-forget)
5. Always emit audit events for state-changing operations
6. Always scope cache invalidation to the correct branch
7. Never emit events for read-only operations
8. Always log event handler failures for debugging
