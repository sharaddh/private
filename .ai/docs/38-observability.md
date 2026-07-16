# 38 - Observability

## Purpose

This document defines observability practices for the KMJ Optical ERP, including logging, metrics, tracing, distributed tracing, and log aggregation. Observability enables understanding system behavior from external outputs.

## Core Principles

1. **Three pillars**: Logging, metrics, and tracing work together.
2. **Structured logging**: All logs must be structured (JSON format).
3. **Context propagation**: Every log must include request context.
4. **Correlation**: All logs for a request must be correlated via request ID.
5. **Minimal overhead**: Observability must not significantly impact performance.

## Detailed Rules

### Structured Logging

#### Log Format

```typescript
// server/src/utils/logger.ts
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  userId?: string;
  branchId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

class Logger {
  private _context: Partial<LogEntry> = {};

  setContext(context: Partial<LogEntry>): void {
    this._context = { ...this._context, ...context };
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  private log(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this._context,
      ...metadata,
    };

    console.log(JSON.stringify(entry));
  }
}

export const logger = new Logger();
```

#### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `debug` | Development debugging | "Query executed" |
| `info` | Normal operations | "Customer created" |
| `warn` | Unexpected but handled | "Cache miss" |
| `error` | Errors requiring attention | "Database connection failed" |

#### Logging Rules

1. **Always use structured logging** (JSON format)
2. **Always include timestamp** in ISO 8601 format
3. **Always include log level**
4. **Always include request context** (requestId, userId, branchId)
5. **Never log sensitive data** (passwords, tokens, card details)
6. **Always log errors** with full context
7. **Always log slow operations** (> 1 second)
8. **Always log external service calls** (WhatsApp, Redis)

### Request Context

#### Context Propagation

```typescript
// server/src/middleware/requestContext.ts
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  userId?: string;
  branchId?: string;
  method: string;
  path: string;
  startTime: number;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function setRequestContext(context: RequestContext): void {
  // Store in AsyncLocalStorage for current request
  requestContext.enterWith(context);
}

// Middleware to set request context
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  setRequestContext({
    requestId,
    userId: req.user?.sub,
    branchId: req.headers['x-branch-id'] as string,
    method: req.method,
    path: req.path,
    startTime: Date.now(),
  });

  res.setHeader('X-Request-Id', requestId);
  next();
};
```

#### Context Rules

1. **Always generate unique request ID** for each request
2. **Always propagate request ID** through all layers
3. **Always include request ID** in all log entries
4. **Always return request ID** in response headers
5. **Always use AsyncLocalStorage** for request-scoped data

### Metrics

#### Metric Types

```typescript
// server/src/utils/metrics.ts
class Metrics {
  private _counters: Map<string, number> = new Map();
  private _histograms: Map<string, number[]> = new Map();
  private _gauges: Map<string, number> = new Map();

  // Counter: Monotonically increasing value
  counter(name: string, value: number = 1): void {
    const current = this._counters.get(name) || 0;
    this._counters.set(name, current + value);
  }

  // Histogram: Distribution of values
  histogram(name: string, value: number): void {
    const values = this._histograms.get(name) || [];
    values.push(value);
    this._histograms.set(name, values);
  }

  // Gauge: Point-in-time value
  gauge(name: string, value: number): void {
    this._gauges.set(name, value);
  }

  // Get metrics for export
  getMetrics(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this._counters),
      histograms: Object.fromEntries(
        Array.from(this._histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
          },
        ])
      ),
      gauges: Object.fromEntries(this._gauges),
    };
  }
}

export const metrics = new Metrics();
```

#### Metrics to Track

```
HTTP Metrics:
- http_requests_total (counter)
- http_request_duration_seconds (histogram)
- http_requests_by_status (counter)

Database Metrics:
- db_query_duration_seconds (histogram)
- db_connections_active (gauge)
- db_errors_total (counter)

Business Metrics:
- customers_created_total (counter)
- orders_created_total (counter)
- payments_processed_total (counter)
- whatsapp_messages_sent_total (counter)

System Metrics:
- process_memory_bytes (gauge)
- process_cpu_seconds_total (counter)
- process_uptime_seconds (gauge)
```

#### Metrics Rules

1. **Always use counters** for monotonically increasing values
2. **Always use histograms** for latency and duration
3. **Always use gauges** for point-in-time values
4. **Always include labels** (method, path, status)
5. **Always export metrics** in Prometheus format
6. **Never store high-cardinality** values as labels

### Distributed Tracing

#### Trace Context

```typescript
// server/src/middleware/tracing.ts
import { AsyncLocalStorage } from 'async_hooks';

interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
}

const traceContext = new AsyncLocalStorage<TraceSpan>();

export function startSpan(operation: string): TraceSpan {
  const parentSpan = traceContext.getStore();
  const span: TraceSpan = {
    traceId: parentSpan?.traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parentSpan?.spanId,
    operation,
    startTime: Date.now(),
    status: 'ok',
    attributes: {},
  };

  traceContext.enterWith(span);
  return span;
}

export function endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok'): void {
  span.endTime = Date.now();
  span.status = status;

  // Export span to tracing system
  exportSpan(span);
}
```

#### Trace Propagation

```typescript
// Propagate trace context through external calls
async function callExternalService(url: string, traceId: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'X-Trace-Id': traceId,
      'X-Parent-Span-Id': getCurrentSpanId(),
    },
  });
}
```

#### Tracing Rules

1. **Always generate trace ID** for each request
2. **Always propagate trace ID** through all layers
3. **Always create spans** for significant operations
4. **Always record span timing**
5. **Always export spans** to tracing system
6. **Use Jaeger or Zipkin** for visualization

### Log Aggregation

#### Centralized Logging

```typescript
// server/src/config/logging.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File transport (for production)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});
```

#### Log Shipping

```typescript
// Ship logs to external service (e.g., LogDNA, Datadog)
if (process.env.LOG_SHIPPING_URL) {
  logger.add(new winston.transports.Http({
    host: process.env.LOG_SHIPPING_URL,
    path: '/logs',
    ssl: true,
  }));
}
```

#### Log Aggregation Rules

1. **Always aggregate logs centrally**
2. **Always use structured format** (JSON)
3. **Always include timestamp** in ISO 8601
4. **Always include request context**
5. **Always set log rotation** (max size, max files)
6. **Always ship logs** to external service in production
7. **Never log sensitive data**
8. **Always set appropriate log levels**

## Bad Examples

```typescript
// BAD: Unstructured logging
console.log('Customer created:', customer);
console.log('Error:', error);

// BAD: Logging sensitive data
console.log('User login:', { username, password });
console.log('Payment:', { cardNumber, cvv });

// BAD: No request context
router.post('/customers', asyncHandler(async (req, res) => {
  console.log('Creating customer'); // No context!
  const customer = await Customer.create(req.body);
  console.log('Customer created'); // No context!
}));
```

## Good Examples

```typescript
// GOOD: Structured logging with context
router.post('/customers', asyncHandler(async (req, res) => {
  const ctx = getRequestContext();
  logger.info('Creating customer', {
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    branchId: ctx?.branchId,
    name: req.body.name,
  });

  const customer = await Customer.create(req.body);

  logger.info('Customer created', {
    requestId: ctx?.requestId,
    customerId: customer._id,
    name: customer.name,
  });

  res.json(created(customer));
}));

// GOOD: Error logging with context
try {
  await sendWhatsAppMessage(phone, message);
} catch (error) {
  logger.error('WhatsApp message failed', error, {
    requestId: ctx?.requestId,
    phone: phone.slice(0, -4) + '****', // Mask sensitive data
    messageType,
  });
  throw error;
}
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Structured logging | Easy parsing and search | More verbose logs |
| Request context | Full traceability | More memory usage |
| Distributed tracing | End-to-end visibility | Additional infrastructure |
| Log aggregation | Centralized search | Additional cost |
| Metrics collection | Performance monitoring | Storage requirements |

## Cross-References

- **Monitoring**: See `docs/37-monitoring.md`
- **Logging**: See `docs/38-observability.md`
- **Performance**: See `docs/21-performance.md`
- **Deployment**: See `docs/36-deployment.md`
- **Security**: See `docs/22-security.md`

## AI Instructions

When implementing observability:
1. Always use structured logging (JSON)
2. Always include request context in logs
3. Always track key metrics
4. Always propagate trace context
5. Never log sensitive data
6. Always set up log aggregation
7. Always configure log rotation
8. Always monitor log levels
9. Always review logs regularly
10. Always document observability setup
