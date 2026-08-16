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
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /api/ready
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: REDIS_URL
        sync: false
      - key: JWT_ACCESS_EXPIRY
        value: 7d
      - key: JWT_REFRESH_EXPIRY
        value: 7d
      - key: RATE_LIMIT_WINDOW_MS
        value: 60000
      - key: RATE_LIMIT_MAX
        value: 1000
      - key: AUTH_RATE_LIMIT_MAX
        value: 30
      - key: LOG_LEVEL
        value: info
      - key: ENABLE_CLUSTER
        value: false
      - key: CLUSTER_WORKERS
        value: 0
```

> The repo is an **npm workspaces monorepo** (`client`, `server`, `warehouse`) with a
> single root `package-lock.json`. `npm ci` installs all three apps; `npm run build`
> builds each. `npm start` runs `node server/dist/index.js`, which serves both SPAs
> (client + warehouse) and the API from one process.

#### Deployment Steps

```
1. Push to main branch (CI runs first)
2. GitHub Actions CI verifies: typecheck, lint, format, tests, build
3. Render detects changes
4. Render runs `npm ci && npm run build`
5. Render runs health checks against /api/ready
6. Render switches traffic to new version
7. Render shuts down old version
```

#### Build Process

```bash
# Root monorepo build (installs client + server + warehouse)
npm ci
npm run build   # tsc for server, vite for client + warehouse
npm run typecheck
npm run lint
npm run test
```

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `4000` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret (fail-fast if missing in prod) | `your-secret-key` |
| `REDIS_URL` | Redis connection string (optional; enables Redis rate limits) | `redis://...` |
| `CORS_ORIGINS` | Comma-separated allowed origins (empty = reflect request origin) | `https://app.kmj.com,https://warehouse.kmj.com` |
| `WAREHOUSE_DB_NAME` | Warehouse MongoDB database name | `kmj_warehouse` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window (per IP / per user) | `1000` |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests per window per IP | `30` |
| `JWT_ACCESS_EXPIRY` | Access token expiry | `7d` |
| `JWT_REFRESH_EXPIRY` | Refresh token expiry | `7d` |
| `LOG_LEVEL` | Pino log level | `info` |
| `ENABLE_CLUSTER` | Run across all CPUs | `false` |
| `CLUSTER_WORKERS` | Worker count (`0` = auto = CPU count) | `0` |
| `TZ` | Application timezone | `Asia/Kolkata` |

#### Security Rules

1. **Never commit** `.env` files to Git
2. **Never log** environment variables
3. **Never expose** secrets in error messages
4. **Always use** strong, unique secrets
5. **Always rotate** secrets periodically
6. **Always use** different secrets per environment

```bash
# GOOD: Environment variables in Render dashboard
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/kmj
JWT_SECRET=super-secret-key-that-is-long-and-random

# BAD: Environment variables in code
const MONGO_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/kmj';
const JWT_SECRET = 'super-secret-key';
```

### Health Checks

#### Health Endpoint

Two endpoints exist:

- `/api/health` — liveness; reports uptime and memory.
- `/api/ready` — readiness; pings MongoDB and returns `{ success: true }` when the
  database is reachable. Used by Render's `healthCheckPath` (503 otherwise).

```typescript
// server/src/routes/health.ts (abridged)
router.get('/ready', asyncHandler(async (req, res) => {
  const dbConnected = await isDatabaseConnected(); // pings MongoDB
  if (!dbConnected) {
    res.status(503).json({ success: false, message: 'Database not ready' });
    return;
  }
  res.status(200).json({ success: true });
}));
```

Request logging (`pino-http`) ignores `/api/health` and `/api/ready` to avoid noise.

#### Health Check Rules

1. **Check database** connectivity (readiness)
2. **Check memory** usage (liveness)
3. **Check uptime** (liveness)
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
curl https://app.kmj.com/api/ready
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
curl https://app.kmj.com/api/ready
```

### Docker

A root `Dockerfile` builds the monorepo in a single multi-stage image:

- **Build stage**: `node:20-slim`, `npm ci && npm run build` (server `tsc`, client +
  warehouse `vite`).
- **Runtime stage**: `node:20-slim` (glibc — required for `bcrypt` native module).
  Copies `package.json`, `package-lock.json`, `node_modules`, and the three `dist`
  folders. `npm ci` runs with install scripts enabled (never `--ignore-scripts`,
  or `bcrypt` will fail).
- Runs `CMD ["node", "server/dist/index.js"]`, `EXPOSE 4000`.

```bash
docker build -t kmj-erp .
docker run -p 4000:4000 \
  -e MONGO_URI=mongodb+srv://... -e JWT_SECRET=... -e NODE_ENV=production \
  kmj-erp
```

The `relay-server/` directory (mediamtx camera relay) is excluded via `.dockerignore`
— it is a separate project and not part of the ERP image.

### CI/CD

`.github/workflows/ci.yml` runs on push to `main` and pull requests, on a matrix of
Node 18 and 20:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4          # node-version: [18.x, 20.x]
    with: { cache: npm }
  - run: npm ci
  - run: npm run typecheck
  - run: npm run lint
  - run: npm run format:check
  - run: npm test
  - run: npm run build
```

CI is the pre-deploy gate: a red build blocks the deploy to Render.

### Cluster Mode

The server can run across all CPUs:

- Set `ENABLE_CLUSTER=true` (and optionally `CLUSTER_WORKERS=N`; `0` = auto).
- The primary process runs MongoDB index migrations once; workers serve requests.
- Requires a shared Redis store (`REDIS_URL`) for cross-process rate limiting.

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
