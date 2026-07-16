# Database Development Checklist

> **Purpose:** Comprehensive checklist for database schema design, indexing, query optimization, migrations, backups, security, and testing.
> **AI Instructions:** Use this checklist for any database-related work including schema changes, query optimization, migrations, or database security reviews. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed.

---

## Schema Design Checklist

- [ ] **Entities are identified and documented** — All major entities (users, orders, products, etc.) are listed with their purpose and relationships.
- [ ] **Normalization is appropriate** — Schema is normalized to at least 3NF to eliminate redundancy. Denormalization is used only where justified by performance requirements with documentation.
- [ ] **Primary keys are well-chosen** — Use UUIDs or auto-incrementing integers consistently. Composite keys are used only when semantically necessary. Primary keys never change.
  ```
  # Good: UUID for distributed systems
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()

  # Good: Auto-increment for single-node
  id BIGSERIAL PRIMARY KEY

  # Bad: Using business data as primary key
  email VARCHAR(255) PRIMARY KEY  -- emails can change!
  ```
- [ ] **Foreign keys are defined** — Every relationship is enforced at the database level with foreign key constraints. No orphaned rows.
- [ ] **Data types are precise** — Use the most appropriate data type: `DECIMAL` for money (not `FLOAT`), `TIMESTAMP WITH TIME ZONE` for dates, `VARCHAR(n)` with appropriate limits, `TEXT` for unbounded strings.
- [ ] **NOT NULL is applied where appropriate** — Required fields have NOT NULL constraints. Don't leave nullable columns that should be required.
- [ ] **DEFAULT values are meaningful** — Timestamps default to `NOW()`. Status fields default to initial state. Boolean fields have explicit defaults.
- [ ] **CHECK constraints enforce business rules** — Age > 0, status in allowed values, date ranges, etc. Business rules at the database level provide a safety net.
- [ ] **Unique constraints are defined** — Business identifiers (emails, usernames, SKU codes) have unique constraints. Composite unique constraints for multi-field uniqueness.
- [ ] **Table and column naming is consistent** — Use snake_case for columns and tables. Table names are plural (`users` not `user`). Names are descriptive and avoid abbreviations.
- [ ] **Soft deletes are considered** — If historical data must be retained, use a `deleted_at` timestamp instead of hard deletes. Document the soft delete pattern for the team.
- [ ] **Audit columns exist** — `created_at`, `updated_at`, `created_by`, `updated_by` columns on all mutable tables. Triggers or application code keep them current.
- [ ] **Schema supports multi-tenancy if needed** — If the application serves multiple tenants, decide on isolation strategy: shared tables with tenant_id, schema-per-tenant, or database-per-tenant.

### Common Mistakes
- Using `FLOAT` for monetary values (precision loss)
- Not defining foreign keys (allows orphaned data)
- Storing large binary objects (BLOBs) in the database instead of object storage
- Using VARCHAR(255) as a universal string type without consideration

---

## Index Design Checklist

- [ ] **Primary key indexes exist** — Primary keys are automatically indexed in most databases. Verify this is the case.
- [ ] **Foreign key columns are indexed** — Every foreign key column has an index. JOINs and cascading operations depend on these.
- [ ] **WHERE clause columns are indexed** — Columns frequently used in WHERE clauses have appropriate indexes. Check query plans to verify index usage.
- [ ] **ORDER BY columns are indexed** — If you sort by a column frequently, an index on that column (or a composite index including it) avoids costly sort operations.
- [ ] **Composite indexes follow the leftmost prefix rule** — Composite indexes are ordered from most selective/used to least. The index is only used if the query includes the leftmost columns.
  ```
  -- For queries like:
  SELECT * FROM orders WHERE user_id = ? AND status = ?;
  SELECT * FROM orders WHERE user_id = ?;

  -- This composite index covers both:
  CREATE INDEX idx_orders_user_status ON orders(user_id, status);
  ```
- [ ] **Covering indexes are used where beneficial** — If a query selects only a few columns, a covering index includes those columns to avoid table lookups entirely.
- [ ] **Partial indexes are used for selective queries** — If you frequently query a subset of rows (e.g., active records), a partial index saves space and improves performance.
  ```sql
  -- Only index active users (most queries filter for active=true)
  CREATE INDEX idx_users_active ON users(email) WHERE active = true;
  ```
- [ ] **Indexes are not excessive** — Each index slows down writes (INSERT, UPDATE, DELETE). Only create indexes that are actually needed by queries.
- [ ] **Index size is monitored** — Large indexes consume memory and slow backups. Monitor index sizes and rebuild/reorganize as needed.
- [ ] **EXPLAIN/ANALYZE is used for verification** — After creating an index, verify with `EXPLAIN ANALYZE` that the query planner actually uses it. Don't assume.
- [ ] **Index maintenance is scheduled** — Plan for index rebuilds (for fragmentation) and statistics updates. Automate this maintenance.

### Common Mistakes
- Creating an index on every column "just in case"
- Not monitoring slow queries to identify missing indexes
- Ignoring composite index column order
- Not removing unused indexes (they slow down writes for no benefit)

---

## Query Optimization Checklist

- [ ] **N+1 queries are eliminated** — Use JOINs, eager loading, or batch queries instead of executing a query inside a loop. Use data loaders for GraphQL.
  ```sql
  -- Bad: N+1 queries
  SELECT * FROM users WHERE id IN (1, 2, 3);
  -- Then for each user:
  SELECT * FROM orders WHERE user_id = 1;
  SELECT * FROM orders WHERE user_id = 2;
  SELECT * FROM orders WHERE user_id = 3;

  -- Good: Single JOIN
  SELECT u.*, o.*
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE u.id IN (1, 2, 3);
  ```
- [ ] **SELECT * is avoided** — Select only the columns you need. `SELECT *` wastes bandwidth, prevents covering index usage, and breaks when schema changes.
- [ ] **Query execution plans are reviewed** — For any query touching >1000 rows, run EXPLAIN ANALYZE. Verify the planner uses expected indexes and join strategies.
- [ ] **Subqueries are optimized** — Correlated subqueries (executed per row) are rewritten as JOINs or CTEs where possible. `EXISTS` is preferred over `IN` for subqueries.
- [ ] **Batch operations are used** — INSERT multiple rows in one statement. UPDATE with a JOIN instead of per-row updates. Use bulk operations for migrations.
- [ ] **LIMIT is used for development queries** — Always include LIMIT when running ad-hoc queries. Never `SELECT *` from a large table without LIMIT in production code.
- [ ] **Connection pooling is configured** — Application uses a connection pool with appropriate min/max sizes. Connections are not opened and closed per request.
- [ ] **Query timeouts are set** — Long-running queries are killed after a timeout to prevent resource exhaustion. Default timeout should be reasonable (e.g., 30 seconds).
- [ ] **Slow query logging is enabled** — Queries exceeding a threshold (e.g., 1 second) are logged with full execution plans. Review slow query logs regularly.
- [ ] **Deadlocks are monitored** — Track deadlock frequency. Reduce deadlock risk by always acquiring locks in the same order. Use appropriate isolation levels.

### Common Mistakes
- Optimizing queries that are never actually slow
- Using ORM-generated queries without checking the SQL they produce
- Not accounting for data growth — a query fast at 10K rows may be slow at 10M rows
- Using `SELECT DISTINCT` to paper over incorrect JOIN logic

---

## Migration Checklist

- [ ] **Migrations are version-controlled** — Every schema change is a migration file in version control. Migration files are named with timestamps or sequential numbers.
- [ ] **Migrations are reversible** — Every migration has a down/rollback method. Test that `up` and `down` produce a clean state.
  ```
  # Up migration
  ALTER TABLE users ADD COLUMN phone VARCHAR(20);

  # Down migration
  ALTER TABLE users DROP COLUMN phone;
  ```
- [ ] **Migrations are backward compatible** — A migration should not break the running application. Use a multi-step approach: add column → deploy code using it → remove old column.
  ```
  # Step 1: Add new column (migration)
  ALTER TABLE users ADD COLUMN display_name VARCHAR(100);

  # Step 2: Deploy code that reads/writes both columns

  # Step 3: Backfill data (separate migration)
  UPDATE users SET display_name = name WHERE display_name IS NULL;

  # Step 4: Deploy code that only uses display_name

  # Step 5: Remove old column (migration)
  ALTER TABLE users DROP COLUMN name;
  ```
- [ ] **Migrations run in a transaction** — Where the database supports it, wrap migrations in a transaction so failures are atomic. PostgreSQL supports this; MySQL does not for DDL.
- [ ] **Data migrations are separated from schema migrations** — Schema changes (DDL) and data changes (DML) are in separate migration files. Data migrations can be slow and may need different strategies.
- [ ] **Migrations are tested in staging** — Run the full migration sequence against a staging database that mirrors production schema and data volume.
- [ ] **Migration downtime is estimated** — For large tables, estimate how long the migration will take. Use online migration tools (gh-ost, pt-online-schema-change) for zero-downtime migrations.
- [ ] **Index creation is online** — Large index creations can lock tables. Use `CREATE INDEX CONCURRENTLY` (PostgreSQL) or online DDL (MySQL 8+) to avoid downtime.
- [ ] **Migration ordering is guaranteed** — Migrations run in the correct order, even with multiple developers creating migrations concurrently.
- [ ] **Rollback plan is documented** — If a migration fails in production, the steps to recover are documented before running it. Include data recovery procedures if applicable.

### Common Mistakes
- Running migrations directly on production without review
- Not testing rollback/down migrations
- Combining unrelated schema changes in one migration
- Not considering how the migration interacts with running application code

---

## Backup Checklist

- [ ] **Automated backups are configured** — Daily automated backups are running and verified. Backups cover all databases, not just the primary.
- [ ] **Backup retention policy is defined** — How long backups are kept: daily for 30 days, weekly for 12 weeks, monthly for 12 months. Adjust for compliance requirements.
- [ ] **Point-in-time recovery is enabled** — WAL/archiving is configured for PostgreSQL, binlog for MySQL. Enables recovery to any point in time, not just last backup.
- [ ] **Backups are tested regularly** — Restore a backup to a test environment at least monthly. Verify data integrity. An untested backup is not a backup.
- [ ] **Backup encryption is enabled** — Backups are encrypted at rest using AES-256 or equivalent. Encryption keys are managed separately from backups.
- [ ] **Off-site backup storage exists** — Backups are stored in a different geographic region or on a different cloud provider. Protects against regional disasters.
- [ ] **Backup monitoring is in place** — Alerts fire if a backup fails, is delayed, or is smaller than expected. Missing backups are detected immediately.
- [ ] **Recovery time objective (RTO) is defined** — Know how quickly you need to restore the database. Size backup infrastructure accordingly.
- [ ] **Recovery point objective (RPO) is defined** — Know the maximum acceptable data loss (e.g., 1 hour). This determines backup frequency.
- [ ] **Backup access is restricted** — Only authorized personnel can restore or delete backups. Backup systems have their own access controls.
- [ ] **Large database backups use incremental strategies** — Full backups daily/weekly, incremental/differential backups between full backups to reduce backup window.

### Common Mistakes
- Setting up backups but never testing a restore
- Storing backups in the same data center as the primary database
- Not monitoring backup completion and health
- Backups without encryption (compliance violation)

---

## Security Checklist

- [ ] **Database credentials are not in code** — Connection strings use environment variables or a secrets manager. Never committed to version control.
- [ ] **Least privilege access** — Database users have minimum required permissions. Application uses a user that can only access its own schema. Admin access is separate and logged.
  ```
  -- Application user: minimal permissions
  CREATE USER app_user WITH PASSWORD '...';
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_user;

  -- Migration user: DDL permissions
  CREATE USER migration_user WITH PASSWORD '...';
  GRANT CREATE, ALTER, DROP ON SCHEMA app TO migration_user;

  -- Admin: full access (used only by DBAs)
  -- Not stored in application config
  ```
- [ ] **SQL injection prevention** — All queries use parameterized statements. ORM query builders handle parameterization. Raw SQL is reviewed for injection risks.
- [ ] **Encryption at rest is enabled** — Database storage is encrypted using platform encryption (AWS RDS encryption, etc.) or transparent data encryption (TDE).
- [ ] **Encryption in transit is enforced** — All database connections use TLS/SSL. Certificate validation is enabled. No unencrypted connections allowed.
- [ ] **Sensitive data is encrypted at the column level** — PII, financial data, and health data have additional column-level encryption. Encryption/decryption is handled in the application layer.
- [ ] **Database activity auditing is enabled** — Log all DDL changes, login attempts, and queries on sensitive tables. Retain audit logs per compliance requirements.
- [ ] **Network access is restricted** — Database is not publicly accessible. Access is limited to application servers and bastion hosts via security groups/firewall rules.
- [ ] **Default credentials are changed** — All default passwords (root, admin, sa) are changed before deployment. Default ports are changed where practical.
- [ ] **Unused database features are disabled** — Features like `LOAD DATA INFILE`, `xp_cmdshell`, and unnecessary extensions are disabled.

### Common Mistakes
- Using `GRANT ALL` for application database users
- Not enabling TLS for database connections (even on internal networks)
- Storing encrypted data without managing encryption keys securely
- Not auditing database admin access

---

## Testing Checklist

- [ ] **Schema tests exist** — Verify table structures, column types, constraints, and indexes match expected schema. Use schema diff tools.
- [ ] **Migration tests run in CI** — Every migration is tested by running up and then down against a clean database. Catches syntax errors and destructive operations.
- [ ] **Query tests are comprehensive** — Critical queries are tested with representative data volumes. Verify correct results, performance, and index usage.
- [ ] **Constraint tests verify enforcement** — Test that CHECK constraints, UNIQUE constraints, NOT NULL, and foreign keys prevent invalid data.
- [ ] **Performance benchmarks exist** — Critical query paths have baseline performance measurements. Automated tests detect performance regressions.
- [ ] **Connection pool tests exist** — Test behavior under connection pressure: pool exhaustion, connection timeouts, and connection recovery after database restarts.
- [ ] **Failover tests are conducted** — If using replication, test failover scenarios. Verify the application handles reconnection gracefully.
- [ ] **Backup and restore tests are scheduled** — Regular automated tests that restore backups and verify data integrity. Monthly manual test of disaster recovery.
- [ ] **Data integrity tests verify business rules** — Test that application-level data integrity rules are enforced (e.g., order total matches sum of line items).
- [ ] **Concurrency tests exist** — Test concurrent access patterns: simultaneous updates, deadlocks, and transaction isolation. Verify correct behavior under contention.

### Common Mistakes
- Testing only with small datasets that don't represent production
- Not testing migrations on a database with realistic data volume
- Assuming ORM behavior matches raw SQL behavior
- Not testing database connection recovery after failures

---

## Cross-References

- See `backend.md` for application-level data access patterns
- See `api.md` for how API design affects database queries
- See `security.md` for database security audit procedures
- See `deployment.md` for database migration deployment
- See `testing.md` for general testing best practices
