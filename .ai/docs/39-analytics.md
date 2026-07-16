# 39 - Analytics

## Purpose

This document defines analytics implementation for the KMJ Optical ERP, including dashboard metrics, business analytics, user analytics, and performance analytics. Analytics provide insights for business decisions and system optimization.

## Core Principles

1. **Actionable insights**: Analytics must drive business decisions.
2. **Real-time where possible**: Dashboard metrics should update in real-time.
3. **Historical tracking**: All metrics must be stored for historical analysis.
4. **Privacy-aware**: User analytics must respect privacy.
5. **Performance-aware**: Analytics must not degrade system performance.

## Detailed Rules

### Dashboard Metrics

#### Real-Time Metrics

```typescript
// server/src/services/analyticsService.ts
class AnalyticsService {
  // Get real-time dashboard metrics
  async getDashboardMetrics(branchId: string): Promise<DashboardMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [customerCount, todayOrders, todayRevenue, pendingPayments] = await Promise.all([
      this.getCustomerCount(branchId),
      this.getTodayOrders(branchId, today),
      this.getTodayRevenue(branchId, today),
      this.getPendingPayments(branchId),
    ]);

    return {
      customerCount,
      todayOrders,
      todayRevenue,
      pendingPayments,
      timestamp: new Date(),
    };
  }

  // Get customer count
  private async getCustomerCount(branchId: string): Promise<number> {
    const Customer = getBranchModel(branchId, 'Customer');
    return Customer.countDocuments();
  }

  // Get today's orders
  private async getTodayOrders(branchId: string, startDate: Date): Promise<number> {
    const Order = getBranchModel(branchId, 'Order');
    return Order.countDocuments({ createdAt: { $gte: startDate } });
  }

  // Get today's revenue
  private async getTodayRevenue(branchId: string, startDate: Date): Promise<number> {
    const Bill = getBranchModel(branchId, 'Bill');
    const result = await Bill.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'Active' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    return result[0]?.total || 0;
  }

  // Get pending payments
  private async getPendingPayments(branchId: string): Promise<number> {
    const Bill = getBranchModel(branchId, 'Bill');
    const result = await Bill.aggregate([
      { $match: { status: 'Active', pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pendingAmount' } } },
    ]);
    return result[0]?.total || 0;
  }
}
```

#### Dashboard Metrics Rules

1. **Cache dashboard metrics** (5-minute TTL)
2. **Use aggregation pipelines** for complex metrics
3. **Pre-compute common metrics** for performance
4. **Update metrics incrementally** when possible
5. **Display loading states** while metrics load

### Business Analytics

#### Revenue Analytics

```typescript
// Revenue by period
async function getRevenueAnalytics(
  branchId: string,
  startDate: Date,
  endDate: Date
): Promise<RevenueAnalytics> {
  const Bill = getBranchModel(branchId, 'Bill');

  const dailyRevenue = await Bill.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'Active' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    daily: dailyRevenue,
    total: dailyRevenue.reduce((sum, day) => sum + day.revenue, 0),
    average: dailyRevenue.reduce((sum, day) => sum + day.revenue, 0) / dailyRevenue.length,
  };
}
```

#### Customer Analytics

```typescript
// Customer demographics
async function getCustomerAnalytics(branchId: string): Promise<CustomerAnalytics> {
  const Customer = getBranchModel(branchId, 'Customer');

  const [ageDistribution, genderDistribution, topCustomers] = await Promise.all([
    // Age distribution
    Customer.aggregate([
      { $match: { age: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$age', 18] }, then: 'Under 18' },
                { case: { $lt: ['$age', 30] }, then: '18-29' },
                { case: { $lt: ['$age', 45] }, then: '30-44' },
                { case: { $lt: ['$age', 60] }, then: '45-59' },
              ],
              default: '60+',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Gender distribution
    Customer.aggregate([
      { $match: { gender: { $exists: true, $ne: null } } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]),

    // Top customers by spend
    Customer.find()
      .sort({ totalSpent: -1 })
      .limit(10)
      .select('name mobile totalSpent totalVisits')
      .lean(),
  ]);

  return {
    ageDistribution,
    genderDistribution,
    topCustomers,
  };
}
```

#### Order Analytics

```typescript
// Order pipeline analytics
async function getOrderAnalytics(branchId: string): Promise<OrderAnalytics> {
  const Order = getBranchModel(branchId, 'Order');

  const [statusDistribution, averageOrderValue, ordersByType] = await Promise.all([
    // Status distribution
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Average order value
    Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, avg: { $avg: '$totalAmount' } } },
    ]),

    // Orders by frame type
    Order.aggregate([
      { $group: { _id: '$frame', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return {
    statusDistribution,
    averageOrderValue: ordersByType[0]?.avg || 0,
    ordersByType,
  };
}
```

### User Analytics

#### Usage Tracking

```typescript
// Track user actions (privacy-aware)
async function trackUserAction(
  userId: string,
  branchId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Only track non-sensitive actions
  const trackedActions = [
    'login',
    'logout',
    'create_customer',
    'create_order',
    'create_bill',
    'process_payment',
    'generate_report',
  ];

  if (!trackedActions.includes(action)) {
    return;
  }

  // Store in analytics collection
  await AnalyticsEvent.create({
    userId,
    branchId,
    action,
    metadata,
    timestamp: new Date(),
  });
}
```

#### User Analytics Rules

1. **Never track sensitive data** (passwords, tokens)
2. **Never track personal data** without consent
3. **Always aggregate** user analytics
4. **Always anonymize** user data for reporting
5. **Always respect** user privacy preferences

### Performance Analytics

#### API Performance

```typescript
// Track API performance
async function trackApiPerformance(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  branchId?: string
): Promise<void> {
  await PerformanceMetric.create({
    type: 'api',
    method,
    path,
    statusCode,
    duration,
    branchId,
    timestamp: new Date(),
  });
}

// Get API performance summary
async function getApiPerformance(
  startDate: Date,
  endDate: Date
): Promise<ApiPerformance> {
  const result = await PerformanceMetric.aggregate([
    { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { method: '$method', path: '$path' },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        p95Duration: { $percentile: { p: 0.95, input: '$duration' } },
        errorRate: {
          $avg: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return { endpoints: result };
}
```

#### Database Performance

```typescript
// Track database performance
async function trackDbPerformance(
  collection: string,
  operation: string,
  duration: number,
  indexUsed: boolean
): Promise<void> {
  await PerformanceMetric.create({
    type: 'database',
    collection,
    operation,
    duration,
    indexUsed,
    timestamp: new Date(),
  });
}
```

### Analytics API

#### REST Endpoints

```typescript
// GET /api/analytics/dashboard
router.get('/dashboard', authenticate, branchScope, asyncHandler(async (req, res) => {
  const metrics = await analyticsService.getDashboardMetrics(req.branchId);
  res.json(success(metrics));
}));

// GET /api/analytics/revenue
router.get('/revenue', authenticate, branchScope, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const analytics = await analyticsService.getRevenueAnalytics(
    req.branchId,
    new Date(startDate as string),
    new Date(endDate as string)
  );
  res.json(success(analytics));
}));

// GET /api/analytics/customers
router.get('/customers', authenticate, branchScope, asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getCustomerAnalytics(req.branchId);
  res.json(success(analytics));
}));

// GET /api/analytics/orders
router.get('/orders', authenticate, branchScope, asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getOrderAnalytics(req.branchId);
  res.json(success(analytics));
}));
```

## Bad Examples

```typescript
// BAD: Synchronous analytics in route handler
router.post('/orders', asyncHandler(async (req, res) => {
  const order = await Order.create(req.body);
  
  // This blocks the response!
  await trackUserAction(req.user.sub, 'create_order', { orderId: order._id });
  await updateDashboardMetrics(req.branchId);
  await sendAnalyticsToExternalService(order);
  
  res.json(created(order));
}));

// BAD: Tracking sensitive data
await trackUserAction(userId, 'login', {
  password: req.body.password, // Never track passwords!
  token: req.headers.authorization, // Never track tokens!
});
```

## Good Examples

```typescript
// GOOD: Non-blocking analytics
router.post('/orders', asyncHandler(async (req, res) => {
  const order = await Order.create(req.body);
  
  // Fire-and-forget analytics
  trackUserAction(req.user.sub, req.branchId, 'create_order', { orderId: order._id })
    .catch(err => console.error('Analytics tracking failed:', err));
  
  res.json(created(order));
}));

// GOOD: Cached dashboard metrics
router.get('/dashboard', authenticate, branchScope, cacheRoute(300), asyncHandler(async (req, res) => {
  const metrics = await analyticsService.getDashboardMetrics(req.branchId);
  res.json(success(metrics));
}));
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Real-time metrics | Immediate insights | Higher compute cost |
| Historical tracking | Trend analysis | Storage requirements |
| Caching metrics | Fast dashboard loads | Potential staleness |
| User analytics | Usage insights | Privacy concerns |
| Performance analytics | Optimization insights | Overhead |

## Cross-References

- **Monitoring**: See `docs/37-monitoring.md`
- **Dashboard**: See `docs/08-frontend.md`
- **Performance**: See `docs/21-performance.md`
- **Database**: See `docs/12-database.md`
- **Caching**: See `docs/24-caching.md`

## AI Instructions

When implementing analytics:
1. Always cache dashboard metrics
2. Always use aggregation pipelines for complex metrics
3. Never track sensitive data
4. Always respect user privacy
5. Always use non-blocking analytics calls
6. Always document analytics endpoints
7. Always test analytics queries
8. Always monitor analytics performance
9. Always verify metric accuracy
10. Always update documentation with new metrics
