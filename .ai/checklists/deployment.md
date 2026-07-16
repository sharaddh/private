# Deployment Checklist

> **Purpose:** Comprehensive checklist for safe, reliable deployments covering pre-deployment, environment configuration, builds, database migrations, health checks, rollback planning, and post-deployment verification.
> **AI Instructions:** Use this checklist before and after every deployment. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed. Never skip the rollback plan section.

---

## Pre-Deployment Checklist

- [ ] **All changes are code-reviewed and approved** — No unreviewed code reaches production. PRs have at least one approval from a qualified reviewer.
- [ ] **All CI checks pass** — Linting, type checking, unit tests, integration tests, and security scans are green on the deployment branch.
- [ ] **Branch is up to date with main** — Rebase or merge the latest main/develop into your branch. Resolve conflicts before deploying.
- [ ] **Feature flags are configured** — New features behind feature flags are set to their initial state (usually disabled). Verify flag values in the deployment config.
- [ ] **Database migrations are tested** — Migrations have been run against staging with production-like data. Rollback migrations are tested and work.
- [ ] **Breaking changes are communicated** — If the deployment includes breaking changes (API, database schema, config format), all affected teams are notified with migration guides.
- [ ] **Deployment window is agreed upon** — If deploying during business hours, the team is aware. Critical deployments may require on-call coverage.
- [ ] **Dependencies are pinned** — Package versions are locked in lock files (package-lock.json, poetry.lock, go.sum). No floating versions in production.
- [ ] **Infrastructure changes are reviewed** — Terraform/CloudFormation changes are reviewed separately from application code. Infrastructure drift is resolved.
- [ ] **Rollback plan is documented** — Specific steps to revert the deployment are written down and reviewed. See Rollback Plan section below.
- [ ] **Monitoring and alerting are in place** — Dashboards are open, alerts are configured for key metrics, and on-call personnel are available.
- [ ] **Freeze periods are respected** — No deployments during known freeze periods (holidays, major events, end of quarter) unless emergency.

### Common Mistakes
- Deploying on a Friday afternoon without on-call coverage
- Assuming staging behavior matches production
- Not communicating breaking changes to dependent teams
- Deploying multiple large changes simultaneously (hard to isolate issues)

---

## Environment Variables Checklist

- [ ] **All required env vars are documented** — Every environment variable the application needs is listed in a central location (e.g., `.env.example`, documentation).
- [ ] **No default secrets** — Default values for secrets (API keys, passwords, tokens) are empty or use placeholder values. Never `SECRET_KEY=changeme` in production.
- [ ] **Environment variables are validated on startup** — Application checks for required environment variables and fails fast with clear error messages if missing.
  ```python
  # Good: Fail fast on missing config
  required_vars = ['DATABASE_URL', 'REDIS_URL', 'SECRET_KEY']
  missing = [v for v in required_vars if not os.environ.get(v)]
  if missing:
      raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")
  ```
- [ ] **Environment-specific values are correct** — Production, staging, and development environments have different configurations. Verify the deployment target environment is correct.
- [ ] **Secrets are stored securely** — Production secrets are in a secrets manager (Vault, AWS Secrets Manager, Azure Key Vault), not in environment variable files or config repos.
- [ ] **Environment variables are encrypted in transit** — CI/CD pipeline injects secrets securely. Secrets are not logged in build output. Secret masking is enabled in CI.
- [ ] **Configuration is version-controlled** — Non-secret configuration (feature flag defaults, rate limits, timeouts) is tracked in version control.
- [ ] **New environment variables are communicated** — If the deployment adds new required env vars, the operations/SRE team is notified before deployment.
- [ ] **Environment variable format is consistent** — Use SCREAMING_SNAKE_CASE. Prefix service-specific vars (e.g., `PAYMENT_API_KEY`, `EMAIL_SMTP_HOST`). No mixing of formats.

### Common Mistakes
- Hardcoding secrets in Dockerfiles or deployment scripts
- Deploying with staging environment variables by mistake
- Not rotating secrets after a team member with access leaves
- Logging environment variables during debugging

---

## Build Checklist

- [ ] **Build is reproducible** — Same commit produces the same artifact. No dependency on external mutable resources during build.
- [ ] **Build runs in CI, not locally** — All builds happen in the CI/CD pipeline. Local builds are for development only.
- [ ] **Dependencies are installed from lock files** — `npm ci` not `npm install`. `pip install -r requirements.txt` with hash checking. Ensures exact dependency versions.
- [ ] **Build cache is configured** — Docker layer caching, CI build caching, or equivalent is configured to speed up builds without sacrificing correctness.
- [ ] **Build artifacts are versioned** — Each build produces a uniquely identifiable artifact (Docker image tag, binary version, npm package version). No overwriting `latest` in production.
- [ ] **Artifact size is reasonable** — Large artifacts slow down deployments. Exclude unnecessary files (tests, documentation, dev tools) from production builds.
- [ ] **Security scanning is in the build pipeline** — Container images are scanned for vulnerabilities (Trivy, Snyk). Dependencies are audited. No known critical vulnerabilities in production artifacts.
- [ ] **Build metadata is recorded** — Git commit SHA, build timestamp, and pipeline ID are embedded in the artifact for traceability.
  ```
  # Docker example
  docker build \
    --build-arg GIT_SHA=$(git rev-parse HEAD) \
    --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
    -t myapp:${GIT_SHA} .
  ```
- [ ] **Multi-stage builds are used** — For container images, use multi-stage builds to keep production images small and secure.
- [ ] **Build warnings are treated seriously** — Deprecation warnings, unused variable warnings, and type warnings are resolved before production deployment.

### Common Mistakes
- Building on a developer's machine and pushing the artifact
- Using `:latest` tag for production deployments
- Not scanning container images for vulnerabilities
- Large Docker images with development tools and test files

---

## Database Migration Checklist

- [ ] **Migrations are backward compatible** — Code changes and database changes are deployed in a compatible order. Schema supports both old and new code versions.
  ```
  # Deployment order for adding a column:
  # 1. Deploy migration: ALTER TABLE ADD COLUMN
  # 2. Deploy code that writes to new column (and still reads old)
  # 3. Deploy code that reads from new column
  # 4. Later: Deploy migration to drop old column
  ```
- [ ] **Migrations have been tested against production-sized data** — Migration runtime on 10K rows is not representative. Test with production-equivalent data volumes.
- [ ] **Online migration tools are used for large tables** — For tables >1M rows, use `gh-ost`, `pt-online-schema-change`, or equivalent to avoid locks.
- [ ] **Migration dependencies are clear** — If migration B depends on migration A, the ordering is enforced. No race conditions between concurrent migration PRs.
- [ ] **Migration rollback is tested** — The down/rollback migration is tested and produces a clean state. Rollback can be executed within the maintenance window.
- [ ] **Data backfill strategy is defined** — If new columns need existing data populated, the backfill strategy is documented. Use batch updates for large tables.
- [ ] **Migration monitoring is in place** — Migration progress is logged. Failures trigger alerts. Long-running migrations are monitored for completion.
- [ ] **Read replicas are considered** — If using read replicas, verify they can handle the migration. Some replication topologies don't replicate DDL automatically.

### Common Mistakes
- Deploying schema changes that break the running application
- Running large ALTER TABLE operations during peak traffic
- Not testing rollback migrations
- Deploying application code and migrations simultaneously (what if migration fails?)

---

## Health Check Checklist

- [ ] **Liveness probe is implemented** — The application responds to a liveness check endpoint when it's running and not deadlocked. Kubernetes/Docker uses this to restart unhealthy instances.
  ```yaml
  # Kubernetes example
  livenessProbe:
    httpGet:
      path: /health/live
      port: 8080
    initialDelaySeconds: 15
    periodSeconds: 10
    failureThreshold: 3
  ```
- [ ] **Readiness probe is implemented** — The application responds to a readiness check only when it can accept traffic (database connected, cache warm, dependencies available). New instances don't receive traffic until ready.
- [ ] **Startup probe is implemented** — For slow-starting applications, a startup probe prevents premature liveness failures. Allows more time for initialization.
- [ ] **Health checks verify dependencies** — Health endpoint checks database connectivity, cache connectivity, and critical external service availability. Not just "is the process running."
- [ ] **Health check is lightweight** — Health checks should be fast (<100ms). Don't run expensive queries or external calls in health checks. Check connectivity, not full functionality.
- [ ] **Health check returns structured data** — Response includes status of each dependency for debugging:
  ```json
  {
    "status": "healthy",
    "checks": {
      "database": { "status": "healthy", "latency_ms": 2 },
      "redis": { "status": "healthy", "latency_ms": 1 },
      "payment_service": { "status": "degraded", "latency_ms": 500 }
    }
  }
  ```
- [ ] **Health check authentication is handled** — Health endpoints may need to bypass authentication (for load balancer probes) but should not expose sensitive data.
- [ ] **Metrics endpoint is available** — Prometheus-format `/metrics` endpoint is exposed for monitoring scraping. Includes request rates, latencies, error rates, and resource usage.

### Common Mistakes
- Liveness and readiness probes doing the same thing
- Health checks that are too expensive and cause self-inflicted DoS
- Not distinguishing between "alive" and "ready to serve traffic"
- Health checks that always return 200 even when the service is degraded

---

## Rollback Plan Checklist

- [ ] **Rollback steps are documented** — Specific, step-by-step instructions to revert the deployment are written before deploying. Not improvised during an incident.
- [ ] **Database rollback is feasible** — If database migrations are included, the rollback migration is tested and ready. If not feasible, assess data migration impact.
- [ ] **Rollback can be executed by on-call** — The person on call can execute the rollback without needing special knowledge. Steps are clear and testable.
- [ ] **Rollback preserves data** — The rollback plan accounts for any data created or modified by the new version. No data loss during rollback.
- [ ] **Rollback is timed** — Estimate how long rollback takes. If it exceeds the acceptable downtime window, plan accordingly.
- [ ] **Feature flags enable instant rollback** — New features behind feature flags can be disabled without a code deployment. This is the fastest rollback mechanism.
- [ ] **Previous version artifact is available** — The previously deployed version's artifact (Docker image, binary) is still available in the artifact registry. Not deleted or overwritten.
- [ ] **Rollback is tested** — Before the deployment, practice the rollback steps in staging. Verify the application works correctly after rollback.
- [ ] **Communication plan is defined** — Who to notify when rolling back, how to update the status page, and how to communicate with affected users.

### Common Mistakes
- Not having a rollback plan and discovering it's needed at 2 AM
- Rollback plan assumes database can be rolled back (sometimes it can't safely)
- Previous version's Docker image was overwritten with `:latest`
- Rollback plan requires someone not on the on-call rotation

---

## Post-Deployment Checklist

- [ ] **Smoke tests pass** — Run a predefined set of critical-path smoke tests immediately after deployment. Verify core functionality works.
- [ ] **Application logs are clean** — No new errors or warnings in application logs. Log levels are appropriate (no DEBUG in production).
- [ ] **Error rates are within normal bounds** — Monitor error rate metrics for 15-30 minutes after deployment. Compare against pre-deployment baseline.
- [ ] **Response times are within SLA** — Latency metrics are stable. No unexpected spikes in p50, p95, or p99 response times.
- [ ] **Resource usage is normal** — CPU, memory, disk, and network metrics are within expected ranges. No resource leaks or sudden increases.
- [ ] **Database performance is stable** — Query latency, connection pool usage, and replication lag are normal. No new slow queries.
- [ ] **External integrations are working** — Verify payment processing, email sending, third-party API calls, and webhook deliveries are functioning.
- [ ] **Feature flags are in correct state** — Verify new features are enabled/disabled as intended. Confirm flag state matches the deployment plan.
- [ ] **Deployment is communicated** — Team is notified of successful deployment. Release notes are published. Status page is updated if applicable.
- [ ] **Deployment metadata is recorded** — Git commit, deployment time, deployer, and any relevant notes are recorded in the deployment log.
- [ ] **Monitoring dashboards are checked** — Review all relevant dashboards for anomalies. Set up alerts for any new endpoints or features.
- [ ] **Backup verification** — If the deployment included database changes, verify backups are still running correctly after the migration.

### Common Mistakes
- Deploying and immediately moving to the next task without monitoring
- Not having a defined "all clear" time after deployment
- Ignoring small increases in error rates (they compound)
- Not recording what was deployed and when (makes rollback harder)

---

## Cross-References

- See `release.md` for release management procedures
- See `security.md` for deployment security considerations
- See `database.md` for database migration best practices
- See `testing.md` for smoke testing procedures
- See `backend.md` for application configuration patterns
