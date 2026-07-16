# 27 - Background Jobs

## Purpose

This document defines background job patterns for the KMJ Optical ERP system, including scheduled tasks, queue processing, WhatsApp message queuing, cache warming, and data synchronization. Background jobs enable non-blocking, reliable, and retryable execution of long-running or deferred work.

## Core Principles

1. **Non-blocking**: API responses must never wait for background jobs to complete.
2. **Reliability**: Jobs must survive process restarts when persisted to a queue.
3. **Retryability**: Failed jobs must be retriable with exponential backoff.
4. **Idempotency**: Running a job twice must produce the same result.
5. **Observability**: All job executions must be logged with status, duration, and errors.

## Detailed Rules

### Job Categories

| Category | Examples | Priority | Retry |
|----------|----------|----------|-------|
| Notifications | WhatsApp messages, SMS | Medium | 3x with backoff |
| Cache | Warming, invalidation | Low | 1x (best effort) |
| Sync | Data synchronization, report generation | Medium | 2x with backoff |
| Cleanup | Old sessions, temp files | Low | 1x |
| Scheduled | Daily reports, backups, reminders | High | 2x with backoff |

### In-Process Job Queue

For the current scale of KMJ Optical, an in-process job queue using a simple array + interval is sufficient. The system does NOT require Redis-based Bull queues unless traffic exceeds ~100 concurrent users.

```typescript
// GOOD: Simple in-process job queue
interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

class JobQueue {
  private _queue: Job[] = [];
  private _processing = false;
  private _interval: NodeJS.Timeout | null = null;

  enqueue(type: string, payload: Record<string, unknown>, maxRetries = 3): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._queue.push({
      id,
      type,
      payload,
      retries: 0,
      maxRetries,
      status: 'pending',
      createdAt: new Date(),
    });
    return id;
  }

  start(processor: (job: Job) => Promise<void>, intervalMs = 5000): void {
    this._interval = setInterval(async () => {
      if (this._processing) return;
      this._processing = true;

      const pendingJobs = this._queue.filter(j => j.status === 'pending');
      for (const job of pendingJobs) {
        job.status = 'processing';
        job.processedAt = new Date();
        try {
          await processor(job);
          job.status = 'completed';
        } catch (err) {
          job.retries++;
          job.error = err instanceof Error ? err.message : String(err);
          if (job.retries >= job.maxRetries) {
            job.status = 'failed';
            console.error(`Job ${job.id} failed after ${job.maxRetries} retries:`, job.error);
          } else {
            job.status = 'pending'; // Re-queue for retry
          }
        }
      }

      // Cleanup completed/failed jobs older than 1 hour
      const oneHourAgo = Date.now() - 3600000;
      this._queue = this._queue.filter(
        j => j.status === 'pending' || j.status === 'processing' || j.createdAt.getTime() > oneHourAgo
      );

      this._processing = false;
    }, intervalMs);
  }

  stop(): void {
    if (this._interval) clearInterval(this._interval);
  }

  get stats() {
    return {
      pending: this._queue.filter(j => j.status === 'pending').length,
      processing: this._queue.filter(j => j.status === 'processing').length,
      completed: this._queue.filter(j => j.status === 'completed').length,
      failed: this._queue.filter(j => j.status === 'failed').length,
    };
  }
}

export const jobQueue = new JobQueue();
```

### WhatsApp Message Queue

WhatsApp messages are queued and sent with rate limiting to avoid being blocked by the Baileys library.

**Rules**:
1. Always queue WhatsApp messages; never send synchronously in route handlers.
2. Always rate-limit: max 1 message per 2 seconds per recipient.
3. Always retry failed messages up to 3 times.
4. Always log delivery status (sent, delivered, failed, rate-limited).
5. Always scope messages to the correct branch WhatsApp connection.

```typescript
// GOOD: WhatsApp message queue
interface WhatsAppJob {
  branchId: string;
  customerId: string;
  messageType: 'bill' | 'order_update' | 'demand_list' | 'payment_reminder';
  data: Record<string, unknown>;
}

// Enqueue WhatsApp message
domainEvents.on('bill:created', (payload) => {
  jobQueue.enqueue('whatsapp:bill', {
    branchId: payload.branchId,
    customerId: payload.customerId,
    messageType: 'bill',
    data: { billId: payload.billId, totalAmount: payload.totalAmount },
  } as WhatsAppJob);
});

// Processor
async function processWhatsAppJob(job: Job): Promise<void> {
  const { branchId, customerId, messageType, data } = job.payload as WhatsAppJob;
  const customer = await getBranchModel(branchId, 'Customer').findById(customerId);
  if (!customer?.mobile) {
    console.warn(`No mobile for customer ${customerId}, skipping WhatsApp`);
    return;
  }

  const message = formatWhatsAppMessage(messageType, data);
  await sendWhatsAppMessage(branchId, customer.mobile, message);
}
```

### Cache Warming

Cache warming pre-populates frequently accessed data to reduce cold-start latency.

**Rules**:
1. Always warm cache on server startup.
2. Always warm cache after bulk data changes (imports, migrations).
3. Never warm cache for rarely accessed endpoints.
4. Always warm branch-specific cache entries.
5. Always log cache warming duration and hit rates.

```typescript
// GOOD: Cache warming on startup
async function warmCache(): Promise<void> {
  const startTime = Date.now();
  const branches = await Branch.find({ isActive: true });

  for (const branch of branches) {
    // Warm dashboard stats
    const stats = await computeDashboardStats(branch.dbName);
    await cacheService.set(`dashboard:${branch._id}:stats`, JSON.stringify(stats), 300);

    // Warm customer list (first page)
    const customers = await getBranchModel(branch.dbName, 'Customer')
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    await cacheService.set(`customers:${branch._id}:page:1`, JSON.stringify(customers), 120);
  }

  console.log(`Cache warmed in ${Date.now() - startTime}ms for ${branches.length} branches`);
}
```

### Data Synchronization

Data sync jobs handle background synchronization between the root database and branch databases.

**Rules**:
1. Always use atomic operations for sync (MongoDB `$set`, `$inc`).
2. Always handle conflicts with last-write-wins strategy.
3. Always log sync operations for debugging.
4. Never sync sensitive data (passwords, tokens).
5. Always validate data before syncing.

```typescript
// GOOD: Customer stats synchronization
async function syncCustomerStats(branchId: string): Promise<void> {
  const Customer = getBranchModel(branchId, 'Customer');
  const Order = getBranchModel(branchId, 'Order');
  const Bill = getBranchModel(branchId, 'Bill');

  const customers = await Customer.find().select('_id').lean();

  for (const customer of customers) {
    const [visitCount, orderStats, billStats] = await Promise.all([
      Order.countDocuments({ customerId: customer._id }),
      Order.aggregate([
        { $match: { customerId: customer._id } },
        { $group: { _id: null, totalSpent: { $sum: '$totalAmount' } } },
      ]),
      Bill.aggregate([
        { $match: { customerId: customer._id, status: 'Active' } },
        { $group: { _id: null, pendingAmount: { $sum: '$pendingAmount' } } },
      ]),
    ]);

    await Customer.findByIdAndUpdate(customer._id, {
      totalVisits: visitCount,
      totalSpent: orderStats[0]?.totalSpent || 0,
      pendingAmount: billStats[0]?.pendingAmount || 0,
    });
  }
}
```

### Scheduled Tasks

Scheduled tasks run at fixed intervals (daily, weekly, monthly).

**Rules**:
1. Always use a lightweight scheduler (node-cron or built-in interval).
2. Always log scheduled task execution times.
3. Always handle overlapping runs (skip if previous run still executing).
4. Always provide a way to disable scheduled tasks via environment variables.

```typescript
// GOOD: Scheduled daily report generation
async function scheduleDailyReports(): Promise<void> {
  // Run at midnight IST
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const delay = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    const branches = await Branch.find({ isActive: true });
    for (const branch of branches) {
      try {
        await generateDailyReport(branch.dbName);
      } catch (err) {
        console.error(`Daily report failed for ${branch.name}:`, err);
      }
    }
    // Reschedule for next day
    scheduleDailyReports();
  }, delay);
}
```

## Bad Examples

```typescript
// BAD: Sending WhatsApp synchronously in route handler
router.post('/bills', authenticate, branchScope, asyncHandler(async (req, res) => {
  const bill = await createBill(req.body);

  // This blocks the response for 2-5 seconds!
  const customer = await Customer.findById(bill.customerId);
  await wa.sendMessage(`${customer.mobile}@c.us`, formatBillMessage(bill));

  res.json(created(bill));
}));
```

```typescript
// BAD: No retry logic, no error handling
function processJob(job: Job) {
  sendWhatsApp(job.payload); // If this fails, the job is lost forever
}
```

```typescript
// BAD: Unbounded queue growth
class BadJobQueue {
  private queue: Job[] = [];

  enqueue(job: Job) {
    this.queue.push(job); // Never cleaned up, grows forever
  }
}
```

## Good Examples

```typescript
// GOOD: Complete background job setup in app.ts
import { jobQueue } from './services/jobQueue';
import { processWhatsAppJob } from './services/whatsappQueue';
import { processCacheInvalidation } from './services/cacheJob';
import { warmCache } from './services/cacheWarming';

// Register processors
jobQueue.register('whatsapp:bill', processWhatsAppJob);
jobQueue.register('whatsapp:order_update', processWhatsAppJob);
jobQueue.register('cache:invalidate', processCacheInvalidation);

// Start queue processor
jobQueue.start(async (job) => {
  const handler = jobQueue.getHandler(job.type);
  if (handler) {
    await handler(job);
  } else {
    console.warn(`No handler for job type: ${job.type}`);
  }
}, 3000);

// Warm cache on startup
warmCache().catch(err => console.error('Cache warming failed:', err));
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| In-process queue | Simple, no dependencies | Lost on process restart |
| Fire-and-forget | Fast API responses | Events may be lost |
| Rate limiting WhatsApp | Prevents blocks | Slower delivery |
| Cache warming | Fast first request | Startup time increase |
| Retry with backoff | Handles transient failures | Delayed final delivery |

## Cross-References

- **Event-driven design**: See `docs/26-event-driven-design.md`
- **Caching**: See `docs/24-caching.md`
- **WhatsApp integration**: See `knowledge/feature-map.md`
- **Performance**: See `docs/21-performance.md`
- **Error handling**: See `docs/19-error-handling.md`

## AI Instructions

When implementing background jobs:
1. Always use the typed job queue, never raw setInterval
2. Always include retry logic with exponential backoff
3. Always wrap job processors in try/catch
4. Never send WhatsApp messages synchronously in route handlers
5. Always log job execution status and duration
6. Always clean up completed/failed jobs periodically
7. Never let a failing job block the queue
8. Always use branch-aware job payloads
