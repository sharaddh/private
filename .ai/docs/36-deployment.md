# 36 - Deployment

## Purpose

This document defines the deployment process for the KMJ Optical ERP, including Render.com deployment, environment variables, build process, health checks, and rollback procedures. Reliable deployment ensures the system is always available to users.

## Core Principles

1. **Zero-downtime deployment**: Deployments must not cause service interruptions.
2. **Rollback capability**: Every deployment must be rollbackable within minutes.
3. **Environment parity**: Development, staging, and production must be as similar as possible.
4. **Automated deployment**: Deployments should be automated via CI/CD.
5. **Verified deployment**: Every deployment must be verified with health checks.

## Detailed Rules

### Render.com Deployment

#### Service Configuration

```yaml
# render.yaml
services:
  - type: web
    name: kmj-backend
    runtime: node
    plan: starter
    buildCommand: cd server && npm install && npm run build
    startCommand: cd server && npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: REDIS_URL
        sync: false
```

#### Deployment Steps

```
1. Push to main branch
2. Render detects changes
3. Render builds the application
4. Render runs health checks
5. Render switches traffic to new version
6. Render shuts down old version
```

#### Build Process

```bash
# Server build
cd server
npm install
npm run build  # TypeScript compilation
npm test       # Run tests (if configured)

# Client build
cd client
npm install
npm run build  # Vite production build
npm run preview  # Verify build works
```

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `REDIS_URL` | Redis connection string | `redis://...` |
| `CORS_ORIGIN` | Allowed origins | `https://app.kmj.com` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `200` |
| `CACHE_TTL_SECONDS` | Default cache TTL | `60` |
| `LOG_LEVEL` | Logging level | `info` |

#### Security Rules

1. **Never commit** `.env` files to Git
2. **Never log** environment variables
3. **Never expose** secrets in error messages
4. **Always use** strong, unique secrets
5. **Always rotate** secrets periodically
6. **Always use** different secrets per environment

```bash
# GOOD: Environment variables in Render dashboard
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/kmj
JWT_SECRET=super-secret-key-that-is-long-and-random

# BAD: Environment variables in code
const MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/kmj';
const JWT_SECRET = 'super-secret-key';
```

### Health Checks

#### Health Endpoint

```typescript
// server/src/routes/health.ts
import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'unknown',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };

  // Check database connection
  try {
    await mongoose.connection.db.admin().ping();
    checks.database = 'connected';
  } catch (error) {
    checks.database = 'disconnected';
    checks.status = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

export default router;
```

#### Health Check Rules

1. **Check database** connectivity
2. **Check memory** usage
3. **Check uptime**
4. **Return appropriate** HTTP status codes
5. **Include timestamp** for monitoring
6. **Never expose** sensitive information

### Rollback Procedure

#### Immediate Rollback

```bash
# 1. Identify the last known good version
git log --oneline -10

# 2. Revert to that version
git revert HEAD  # Or specific commit

# 3. Push to main
git push origin main

# 4. Render auto-deploys the revert

# 5. Verify rollback
curl https://app.kmj.com/api/health
```

#### Manual Rollback (Render Dashboard)

```
1. Go to Render dashboard
2. Select the service
3. Go to "Deploys" tab
4. Find the last successful deploy
5. Click "Rollback to this deploy"
6. Confirm rollback
7. Verify health endpoint
```

#### Rollback Rules

1. **Rollback within 5 minutes** if issues detected
2. **Never rollback** during active database migrations
3. **Always verify** health after rollback
4. **Always document** why rollback was needed
5. **Always investigate** root cause before re-deploying

### Deployment Checklist

#### Pre-Deployment

- [ ] All tests pass
- [ ] All linting passes
- [ ] All type checking passes
- [ ] Database migrations are ready
- [ ] Environment variables are configured
- [ ] Health check endpoint works
- [ ] Rollback plan is documented

#### During Deployment

- [ ] Monitor Render deployment logs
- [ ] Monitor application logs
- [ ] Monitor database connections
- [ ] Monitor error rates

#### Post-Deployment

- [ ] Health check returns 200
- [ ] All API endpoints work
- [ ] All UI pages load
- [ ] All features work
- [ ] No increase in error rates
- [ ] No increase in response times

### Deployment Schedule

#### Regular Deployments

- **Time**: Tuesday-Thursday, 10 AM IST
- **Duration**: 15-30 minutes
- **Impact**: Zero-downtime (blue-green deployment)

#### Hotfix Deployments

- **Time**: Any time (emergency only)
- **Duration**: 5-15 minutes
- **Impact**: Minimal (targeted fix)

#### Maintenance Windows

- **Time**: Sunday, 2 AM IST
- **Duration**: 1-2 hours
- **Impact**: Possible downtime (database maintenance)

## Bad Examples

```bash
# BAD: Deploying without tests
git push origin main  # No tests run!

# BAD: Deploying on Friday afternoon
# Weekend issues won't be noticed until Monday

# BAD: No rollback plan
# If deployment fails, what do we do?

# BAD: Deploying database migrations without backup
# Data loss risk!
```

## Good Examples

```bash
# GOOD: Safe deployment process
# 1. Create feature branch
git checkout -b feat/new-feature

# 2. Make changes
# ... code changes ...

# 3. Run tests
npm test

# 4. Run linting
npm run lint

# 5. Run type checking
npm run typecheck

# 6. Create PR
git push origin feat/new-feature
# Create PR on GitHub

# 7. Get review approval
# ... review process ...

# 8. Merge to main
# Squash and merge

# 9. Monitor deployment
# Watch Render dashboard

# 10. Verify deployment
curl https://app.kmj.com/api/health
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Zero-downtime deployment | No service interruption | More complex setup |
| Automated deployment | Consistent, repeatable | Less manual control |
| Health checks | Early detection of issues | Additional endpoints |
| Rollback capability | Quick recovery | Requires version management |
| Environment parity | Consistent behavior | More environments to maintain |

## Cross-References

- **CI/CD**: See `docs/36-deployment.md`
- **Monitoring**: See `docs/37-monitoring.md`
- **Environment variables**: See `docs/36-deployment.md`
- **Database migrations**: See `docs/12-database.md`
- **Security**: See `docs/22-security.md`

## AI Instructions

When deploying changes:
1. Always run tests before deploying
2. Always run linting before deploying
3. Always verify health checks after deploying
4. Always have a rollback plan
5. Always deploy during safe hours
6. Never deploy without approval
7. Never deploy database migrations without backup
8. Always monitor deployment logs
9. Always verify all features after deployment
10. Always document deployment issues
