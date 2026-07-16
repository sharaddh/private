# 41 - Checklists

## Purpose

This document provides master checklists for the KMJ Optical ERP project, including pre-deployment, pre-release, pre-refactoring, security audit, and performance audit checklists. Checklists ensure consistent quality and prevent oversight.

## Core Principles

1. **Every checklist is mandatory**: No exceptions without Chief Architect approval.
2. **Every item must be verified**: Don't assume—verify.
3. **Every checklist is documented**: Record completion for audit trails.
4. **Every checklist is updated**: Add new items as issues are discovered.
5. **Every checklist is shared**: Team members must know and use checklists.

## Detailed Rules

### Pre-Deployment Checklist

#### Code Quality

- [ ] All tests pass (`npm test`)
- [ ] All linting passes (`npm run lint`)
- [ ] All type checking passes (`npm run typecheck`)
- [ ] No `any` types used
- [ ] All functions have return types
- [ ] All inputs are validated
- [ ] All errors are handled

#### Feature Preservation

- [ ] All API endpoints return same responses
- [ ] All database operations preserved
- [ ] All business rules maintained
- [ ] All permissions enforced
- [ ] All audit logs generated
- [ ] All WhatsApp notifications work
- [ ] All reports show correct data

#### Security

- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages
- [ ] Authentication required for protected endpoints
- [ ] Authorization enforced
- [ ] Input validation in place
- [ ] Rate limiting applied
- [ ] CORS properly configured

#### Performance

- [ ] Database queries use indexes
- [ ] No N+1 queries
- [ ] Pagination for list queries
- [ ] Lean queries for read-only operations
- [ ] Caching where appropriate
- [ ] No memory leaks

#### Documentation

- [ ] Complex logic documented
- [ ] API endpoints documented
- [ ] Business rules documented
- [ ] README updated if needed
- [ ] CHANGELOG updated if needed

### Pre-Release Checklist

#### Features

- [ ] All planned features implemented
- [ ] All features tested
- [ ] All features documented
- [ ] All features work on mobile
- [ ] All features work on dark mode
- [ ] All features accessible (ARIA)

#### Bug Fixes

- [ ] All critical bugs fixed
- [ ] All high-priority bugs fixed
- [ ] All medium-priority bugs fixed
- [ ] Regression tests added

#### Documentation

- [ ] README updated
- [ ] API documentation updated
- [ ] Architecture documentation updated
- [ ] User guide updated (if needed)

#### Deployment

- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Health check endpoint working
- [ ] Rollback plan documented
- [ ] Deployment schedule communicated

#### Monitoring

- [ ] Health checks configured
- [ ] Error tracking configured
- [ ] Performance monitoring configured
- [ ] Alerting configured

### Pre-Refactoring Checklist

#### Understanding

- [ ] Code fully read and understood
- [ ] Git history checked for context
- [ ] All importers identified
- [ ] All tests identified
- [ ] All documentation identified

#### Planning

- [ ] Refactoring goal defined
- [ ] Scope limited (≤ 3 files)
- [ ] Steps planned
- [ ] Rollback plan defined
- [ ] Timeline estimated

#### Testing

- [ ] Existing tests identified
- [ ] New tests written
- [ ] Tests cover edge cases
- [ ] Tests cover error scenarios

#### Implementation

- [ ] Small, incremental changes
- [ ] Tests run after each change
- [ ] Feature parity verified
- [ ] No API contract changes
- [ ] No database schema changes

#### Verification

- [ ] All tests pass
- [ ] All features preserved
- [ ] No performance regression
- [ ] Documentation updated

### Security Audit Checklist

#### Authentication

- [ ] JWT tokens properly validated
- [ ] JWT tokens expire appropriately
- [ ] Passwords properly hashed
- [ ] Session management secure
- [ ] Multi-factor authentication (if applicable)

#### Authorization

- [ ] Role-based access control enforced
- [ ] Branch-based access control enforced
- [ ] No privilege escalation
- [ ] No unauthorized data access

#### Input Validation

- [ ] All inputs validated with Zod
- [ ] SQL injection prevented (Mongoose)
- [ ] XSS prevented (output encoding)
- [ ] CSRF protection enabled
- [ ] File upload validation

#### Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data encrypted in transit
- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages
- [ ] No sensitive data in URLs

#### Configuration

- [ ] No hardcoded secrets
- [ ] Environment variables used
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced

#### External Services

- [ ] WhatsApp integration secure
- [ ] MongoDB Atlas secure
- [ ] Redis secure (if used)
- [ ] Third-party APIs secure

### Performance Audit Checklist

#### Database

- [ ] All query fields indexed
- [ ] No N+1 queries
- [ ] Aggregation pipelines optimized
- [ ] Connection pooling configured
- [ ] Query slow logs reviewed

#### API

- [ ] Response times < 200ms (p95)
- [ ] Pagination implemented
- [ ] Caching implemented
- [ ] Compression enabled
- [ ] Rate limiting appropriate

#### Frontend

- [ ] Bundle size < 500KB
- [ ] Code splitting implemented
- [ ] Lazy loading implemented
- [ ] Images optimized
- [ ] Fonts optimized

#### Memory

- [ ] No memory leaks
- [ ] Heap usage < 500MB
- [ ] No unbounded arrays
- [ ] No unbounded event listeners
- [ ] Proper cleanup on shutdown

#### Scalability

- [ ] Horizontal scaling possible
- [ ] Database sharding ready (if needed)
- [ ] CDN configured for static assets
- [ ] Load balancing configured
- [ ] Auto-scaling configured

## Checklist Usage Rules

### Before Any Change

1. **Read the relevant checklist**
2. **Verify all items** before proceeding
3. **Document completion** in PR description
4. **Update checklist** if new items discovered

### During Code Review

1. **Verify checklist completion** in PR
2. **Check for missed items**
3. **Request changes** if items missed
4. **Approve only when** all items verified

### After Deployment

1. **Verify deployment** via health check
2. **Verify features** work correctly
3. **Verify monitoring** is active
4. **Document any issues** discovered

## Bad Examples

```markdown
# BAD: Incomplete checklist
## Pre-Deployment
- [x] Tests pass
- [x] Linting passes
- [ ] Feature preservation verified
- [ ] Security reviewed

# BAD: Skipping checklist
"Let's just deploy quickly, we can check later"

# BAD: Outdated checklist
## Pre-Deployment (last updated 6 months ago)
# Missing new items like accessibility checks
```

## Good Examples

```markdown
# GOOD: Complete checklist
## Pre-Deployment
### Code Quality
- [x] All tests pass (`npm test`)
- [x] All linting passes (`npm run lint`)
- [x] All type checking passes (`npm run typecheck`)
- [x] No `any` types used
- [x] All functions have return types
- [x] All inputs are validated
- [x] All errors are handled

### Feature Preservation
- [x] All API endpoints return same responses
- [x] All database operations preserved
- [x] All business rules maintained
- [x] All permissions enforced
- [x] All audit logs generated
- [x] All WhatsApp notifications work
- [x] All reports show correct data
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Mandatory checklists | Consistent quality | More process overhead |
| Detailed checklists | Nothing missed | Longer review time |
| Regular updates | Keeps checklists current | Maintenance effort |
| Documentation | Audit trails | More documentation |
| Team sharing | Consistent usage | Training required |

## Cross-References

- **Code review**: See `docs/30-code-review.md`
- **Deployment**: See `docs/36-deployment.md`
- **Security**: See `docs/22-security.md`
- **Performance**: See `docs/21-performance.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`

## AI Instructions

When using checklists:
1. Always read the relevant checklist before starting
2. Always verify all items before proceeding
3. Always document completion in PR description
4. Never skip checklist items
5. Always update checklists when new items discovered
6. Always verify checklists during code review
7. Always use checklists for deployment
8. Always use checklists for security audits
9. Always use checklists for performance audits
10. Always share checklist updates with team
