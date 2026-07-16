# 37 - Monitoring

## Purpose

This document defines monitoring practices for the KMJ Optical ERP, including health checks, uptime monitoring, error tracking, performance monitoring, and alerting. Monitoring ensures the system is reliable and issues are detected early.

## Core Principles

1. **Proactive monitoring**: Detect issues before users notice them.
2. **Comprehensive coverage**: Monitor all critical system components.
3. **Actionable alerts**: Alerts must be actionable and not cause alert fatigue.
4. **Performance baseline**: Establish and monitor performance baselines.
5. **Error tracking**: Track all errors with context for debugging.

## Detailed Rules

### Health Checks

#### Health Endpoint

```typescript
// server/src/routes/health.ts
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      memory: checkMemory(),
      disk: checkDisk(),
    },
  };

  const isHealthy = Object.values(health.checks).every(
    check => check.status === 'ok'
  );

  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkDatabase(): Promise<CheckResult> {
  try {
    await mongoose.connection.db.admin().ping();
    return { status: 'ok', latency: await measureDbLatency() };
  } catch (error) {
    return { status: 'error', message: 'Database connection failed' };
  }
}

function checkMemory(): CheckResult {
  const used = process.memoryUsage();
  const heapUsedMB = used.heapUsed / 1024 / 1024;
  const heapTotalMB = used.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  if (usagePercent > 90) {
    return { status: 'error', message: 'Memory usage critical' };
  }
  if (usagePercent > 70) {
    return { status: 'warning', message: 'Memory usage high' };
  }
  return { status: 'ok', heapUsedMB, heapTotalMB, usagePercent };
}
```

#### Health Check Rules

1. **Check database** connectivity and latency
2. **Check memory** usage
3. **Check disk** usage (if applicable)
4. **Check external services** (WhatsApp, Redis)
5. **Return appropriate** HTTP status codes
6. **Include version** information
7. **Include uptime** information

### Uptime Monitoring

#### External Monitoring

Use external monitoring services (UptimeRobot, Pingdom, or similar):

```
Monitor Configuration:
- URL: https://app.kmj.com/api/health
- Interval: 5 minutes
- Timeout: 30 seconds
- Alert conditions:
  - HTTP status != 200
  - Response time > 5 seconds
  - SSL certificate expiring < 30 days
```

#### Uptime Rules

1. **Monitor from multiple locations**
2. **Check every 5 minutes**
3. **Alert on 2 consecutive failures**
4. **Track uptime percentage** (target: 99.9%)
5. **Document all downtime** incidents

### Error Tracking

#### Error Logging

```typescript
// server/src/middleware/errorHandler.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorContext = {
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
    userId: req.user?.sub || 'anonymous',
    branchId: req.headers['x-branch-id'] || 'root',
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };

  // Log error with context
  console.error('Error:', {
    ...errorContext,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  });

  // Send to external error tracking (Sentry, LogRocket, etc.)
  if (process.env.NODE_ENV === 'production') {
    sendToErrorTracking(err, errorContext);
  }

  // Return user-friendly error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
};
```

#### Error Tracking Rules

1. **Log all errors** with context
2. **Include request context** (user, branch, path)
3. **Include error details** (name, message, stack)
4. **Send to external service** in production
5. **Never log sensitive data** (passwords, tokens)
6. **Track error rates** over time
7. **Alert on error rate spikes**

### Performance Monitoring

#### Response Time Tracking

```typescript
// server/src/middleware/timing.ts
export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.sub || 'anonymous',
      branchId: req.headers['x-branch-id'] || 'root',
    };

    // Log slow requests
    if (duration > 1000) {
      console.warn('Slow request:', log);
    }

    // Log all requests in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Request:', log);
    }
  });

  next();
};
```

#### Database Query Monitoring

```typescript
// server/src/config/db.ts
mongoose.set('debug', (collectionName: string, methodName: string, ...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`DB: ${collectionName}.${methodName}`, args);
  }
});

// Track slow queries
mongoose.set('debug', function (collectionName: string, methodName: string, methodArgs: any[], query: any) {
  const start = Date.now();
  query.on('exec', function () {
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`Slow query: ${collectionName}.${methodName} took ${duration}ms`);
    }
  });
});
```

#### Performance Rules

1. **Track response times** for all endpoints
2. **Track database query** times
3. **Track memory usage** over time
4. **Track CPU usage** over time
5. **Set performance baselines**
6. **Alert on performance** degradation

### Alerting

#### Alert Levels

| Level | Condition | Action |
|-------|-----------|--------|
| Critical | System down, data loss | Immediate response |
| Error | Feature broken, high error rate | Response within 1 hour |
| Warning | Performance degraded | Response within 4 hours |
| Info | Unusual but not critical | Review within 24 hours |

#### Alert Rules

```typescript
// Alert configuration
const alerts = {
  // Critical alerts
  systemDown: {
    condition: 'health check fails 3 times',
    action: 'page on-call engineer',
    cooldown: '5 minutes',
  },
  databaseDown: {
    condition: 'database connection fails',
    action: 'page on-call engineer',
    cooldown: '5 minutes',
  },

  // Error alerts
  highErrorRate: {
    condition: 'error rate > 5% for 5 minutes',
    action: 'notify team',
    cooldown: '15 minutes',
  },
  errorSpike: {
    condition: 'error rate > 10% for 1 minute',
    action: 'page on-call engineer',
    cooldown: '5 minutes',
  },

  // Performance alerts
  slowResponses: {
    condition: 'p95 response time > 2 seconds for 5 minutes',
    action: 'notify team',
    cooldown: '30 minutes',
  },
  memoryHigh: {
    condition: 'memory usage > 80% for 10 minutes',
    action: 'notify team',
    cooldown: '1 hour',
  },

  // Business alerts
  lowDiskSpace: {
    condition: 'disk usage > 90%',
    action: 'notify team',
    cooldown: '1 hour',
  },
  sslExpiring: {
    condition: 'SSL certificate expires in < 30 days',
    action: 'notify team',
    cooldown: '1 day',
  },
};
```

#### Alert Rules

1. **Every alert must be actionable**
2. **Every alert must have a response procedure**
3. **Every alert must have a cooldown period**
4. **Every alert must be documented**
5. **Alert fatigue must be minimized**

### Monitoring Dashboard

#### Key Metrics

```
System Metrics:
- Uptime percentage
- Response time (p50, p95, p99)
- Error rate
- Request throughput
- Memory usage
- CPU usage
- Disk usage

Business Metrics:
- Active users
- Orders created
- Payments processed
- WhatsApp messages sent

Database Metrics:
- Connection pool usage
- Query latency
- Index usage
- Collection sizes
```

#### Dashboard Rules

1. **Display real-time** metrics
2. **Display historical** trends
3. **Display alerts** and incidents
4. **Display service** health
5. **Display business** metrics

## Bad Examples

```typescript
// BAD: No error logging
try {
  const data = await fetchData();
} catch (e) {
  // Swallowed error!
}

// BAD: Logging sensitive data
console.log('User login:', { username, password });

// BAD: No performance monitoring
router.get('/customers', asyncHandler(async (req, res) => {
  const customers = await Customer.find(); // No timing!
  res.json(success(customers));
}));
```

## Good Examples

```typescript
// GOOD: Comprehensive error logging
try {
  const data = await fetchData();
} catch (error) {
  logger.error('Failed to fetch data', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.sub,
    branchId: req.branchId,
    path: req.path,
  });
  throw new AppError(500, 'Failed to fetch data');
}

// GOOD: Performance monitoring
const start = Date.now();
const customers = await Customer.find();
const duration = Date.now() - start;
logger.info('Customer query completed', { duration, count: customers.length });
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Comprehensive monitoring | Early issue detection | More infrastructure |
| External uptime monitoring | Independent verification | Additional cost |
| Error tracking service | Better debugging | Privacy concerns |
| Performance baselines | Clear expectations | Setup effort |
| Alerting rules | Actionable alerts | Alert fatigue risk |

## Cross-References

- **Deployment**: See `docs/36-deployment.md`
- **Observability**: See `docs/38-observability.md`
- **Logging**: See `docs/38-observability.md`
- **Performance**: See `docs/21-performance.md`
- **Security**: See `docs/22-security.md`

## AI Instructions

When implementing monitoring:
1. Always log errors with context
2. Always track performance metrics
3. Always set up health checks
4. Always configure alerting
5. Never log sensitive data
6. Always document monitoring setup
7. Always test alerting rules
8. Always review monitoring dashboards
9. Always respond to alerts promptly
10. Always document incidents
