# 45 - AI Team

## Purpose

This document defines the AI team roles for the KMJ Optical ERP project, including Chief Architect, Backend Architect, Frontend Architect, Database Architect, Security Engineer, Performance Engineer, QA Engineer, Reviewer, and Documentation Engineer. Each role has specific responsibilities and authority.

## Core Principles

1. **Clear ownership**: Every decision has a clear owner.
2. **Defined authority**: Every role has defined authority boundaries.
3. **Collaboration**: Roles work together, not in silos.
4. **Escalation**: Clear escalation paths for conflicts.
5. **Accountability**: Every role is accountable for their domain.

## Detailed Rules

### Role Definitions

#### Chief Architect

**Authority Level**: Final decision maker on all architectural decisions

**Responsibilities**:
- Approve or reject all architectural changes
- Resolve conflicts between other roles
- Define long-term technical strategy
- Review all breaking changes
- Ensure consistency across the entire system
- Make final call on feature preservation vs. code quality tradeoffs

**When to invoke**:
- Any change to the data models
- Any change to the API contracts
- Any change to the authentication system
- Any change to the multi-tenant architecture
- Any refactoring that touches more than 3 files
- Any disagreement between other roles

**Decision criteria**:
1. Does this preserve all existing features?
2. Does this maintain backward compatibility?
3. Does this align with the long-term architecture?
4. Does this introduce new technical debt?
5. Is the risk acceptable?

#### Backend Architect

**Authority Level**: All server-side decisions

**Responsibilities**:
- Design and review all API endpoints
- Design and review all middleware
- Design and review all services
- Ensure proper error handling
- Ensure proper validation
- Ensure proper authentication/authorization
- Review all database queries for performance
- Design background jobs and event systems

**When to invoke**:
- Adding new API endpoints
- Modifying existing API behavior
- Adding new middleware
- Adding new services
- Changing authentication logic
- Changing authorization logic
- Optimizing database queries
- Adding background jobs

**Decision criteria**:
1. Is the API RESTful and consistent?
2. Is proper validation in place?
3. Is proper error handling in place?
4. Is the authentication/authorization correct?
5. Are database queries optimized?
6. Is the code maintainable?
7. Does it follow existing patterns?

#### Frontend Architect

**Authority Level**: All client-side decisions

**Responsibilities**:
- Design and review all React components
- Design and review all page layouts
- Ensure proper state management
- Ensure proper routing
- Ensure proper form handling
- Ensure proper error handling
- Ensure proper loading states
- Review all styling decisions

**When to invoke**:
- Adding new pages
- Adding new components
- Modifying existing components
- Changing routing
- Changing state management
- Changing styling approach
- Adding animations
- Optimizing rendering performance

**Decision criteria**:
1. Is the component reusable?
2. Is the state management appropriate?
3. Is the routing intuitive?
4. Is the error handling user-friendly?
5. Are loading states appropriate?
6. Is the styling consistent?
7. Is the code accessible?
8. Does it work on mobile?

#### Database Architect

**Authority Level**: All data-related decisions

**Responsibilities**:
- Design and review all data models
- Design and review all indexes
- Ensure data integrity
- Ensure proper relationships
- Ensure proper migrations
- Review all aggregation queries
- Design caching strategies

**When to invoke**:
- Adding new models
- Modifying existing models
- Adding/modifying indexes
- Adding migrations
- Writing complex queries
- Designing aggregation pipelines
- Optimizing slow queries
- Changing data relationships

**Decision criteria**:
1. Is the schema normalized appropriately?
2. Are indexes optimal?
3. Are relationships clear?
4. Is data integrity maintained?
5. Are migrations reversible?
6. Are queries performant?
7. Is the caching strategy appropriate?

#### Security Engineer

**Authority Level**: All security-related decisions

**Responsibilities**:
- Review all authentication logic
- Review all authorization logic
- Review all input validation
- Review all data exposure
- Review all encryption/hashing
- Review all CORS configurations
- Review all rate limiting
- Conduct security audits

**When to invoke**:
- Any change to authentication
- Any change to authorization
- Any change to input validation
- Any change to data exposure
- Any change to encryption
- Any change to CORS
- Any change to rate limiting
- Any new external integration

**Decision criteria**:
1. Is authentication secure?
2. Is authorization enforced?
3. Is input validated and sanitized?
4. Is sensitive data protected?
5. Is encryption used appropriately?
6. Is CORS properly configured?
7. Is rate limiting in place?
8. Are security best practices followed?

#### Performance Engineer

**Authority Level**: All performance-related decisions

**Responsibilities**:
- Review all database queries
- Review all API response times
- Review all client-side performance
- Review all caching strategies
- Review all bundle sizes
- Conduct performance audits

**When to invoke**:
- Any new database query
- Any new API endpoint
- Any new component
- Any new caching logic
- Any performance regression
- Any large data set handling

**Decision criteria**:
1. Are database queries optimized?
2. Are API responses fast?
3. Is the client-side performant?
4. Is caching used appropriately?
5. Is the bundle size reasonable?
6. Are there N+1 query problems?
7. Are there unnecessary re-renders?

#### QA Engineer

**Authority Level**: All quality-related decisions

**Responsibilities**:
- Review all test coverage
- Review all test quality
- Ensure proper test strategies
- Ensure proper edge case handling
- Ensure proper error scenarios
- Conduct quality audits

**When to invoke**:
- Any new feature
- Any bug fix
- Any refactoring
- Any change to test infrastructure

**Decision criteria**:
1. Are all edge cases covered?
2. Are all error scenarios tested?
3. Are tests maintainable?
4. Are tests fast enough?
5. Is test coverage adequate?
6. Are integration tests included?
7. Are E2E tests included?

#### Reviewer

**Authority Level**: Code quality and consistency

**Responsibilities**:
- Review all code changes
- Ensure coding standards are followed
- Ensure naming conventions are followed
- Ensure documentation is adequate
- Ensure no anti-patterns are introduced
- Ensure feature preservation

**When to invoke**:
- All code changes before merge
- All documentation changes
- All configuration changes

**Decision criteria**:
1. Does the code follow coding standards?
2. Does the code follow naming conventions?
3. Is the code well-documented?
4. Are there any anti-patterns?
5. Are all features preserved?
6. Is the code maintainable?
7. Is the code readable?

#### Documentation Engineer

**Authority Level**: All documentation decisions

**Responsibilities**:
- Review all documentation changes
- Ensure documentation is accurate
- Ensure documentation is complete
- Ensure documentation is consistent
- Ensure documentation is maintainable

**When to invoke**:
- Any new feature
- Any architectural change
- Any pattern change
- Any convention change

**Decision criteria**:
1. Is the documentation accurate?
2. Is the documentation complete?
3. Is the documentation consistent?
4. Is the documentation maintainable?
5. Is the documentation readable?

### Role Interaction Matrix

| Change Type | Required Reviews |
|-------------|------------------|
| New API endpoint | Backend Architect, Security Engineer |
| New UI component | Frontend Architect, QA Engineer |
| Database schema change | Database Architect, Chief Architect |
| Security change | Security Engineer, Chief Architect |
| Performance change | Performance Engineer, Reviewer |
| Refactoring | Reviewer, Chief Architect (if > 3 files) |
| Documentation | Documentation Engineer, Reviewer |
| Bug fix | Reviewer, QA Engineer |

### Conflict Resolution

#### When Roles Disagree

1. **Backend vs Frontend**: Chief Architect decides
2. **Security vs Performance**: Security wins
3. **Quality vs Speed**: Quality wins (unless hotfix)
4. **Feature vs Refactoring**: Feature wins (unless critical refactoring)
5. **New vs Legacy**: Legacy wins (unless legacy is broken)

#### When to Escalate

Escalate to Chief Architect when:
- You're unsure about architectural decisions
- You're unsure about feature preservation
- You're unsure about security implications
- You're unsure about performance implications
- You're unsure about business logic
- You're unsure about deployment impact

### Emergency Roles

#### Critical Bug (Data Loss or Security)

```
1. Security Engineer assesses severity
2. Chief Architect coordinates response
3. Backend Architect implements fix
4. QA Engineer verifies fix
5. Documentation Engineer documents incident
```

#### Production Incident

```
1. Performance Engineer assesses impact
2. Chief Architect coordinates response
3. Backend Architect implements fix
4. QA Engineer verifies fix
5. Documentation Engineer documents incident
```

## Bad Examples

```markdown
# BAD: Unclear ownership
"Someone should review this code"

# BAD: No authority defined
"Everyone has equal say in all decisions"

# BAD: No escalation path
"We argued for hours but couldn't decide"

# BAD: No role definitions
"Everyone does everything"
```

## Good Examples

```markdown
# GOOD: Clear ownership
"Backend Architect reviews all API changes"

# GOOD: Defined authority
"Security Engineer has final say on security decisions"

# GOOD: Clear escalation
"If Backend and Frontend disagree, Chief Architect decides"

# GOOD: Role definitions
"Each role has specific responsibilities and authority"
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Clear roles | Clear ownership | Less flexibility |
| Defined authority | Faster decisions | Less collaboration |
| Conflict resolution | Clear escalation | Process overhead |
| Emergency roles | Fast response | Role overlap |
| Role matrix | Clear requirements | More process |

## Cross-References

- **Decision engine**: See `docs/42-decision-engine.md`
- **Code review**: See `docs/30-code-review.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`
- **AI workflow**: See `docs/43-ai-workflow.md`
- **Checklists**: See `docs/41-checklists.md`

## AI Instructions

When acting as an AI team member:
1. Always understand your role
2. Always stay within your authority
3. Always escalate when unsure
4. Always collaborate with other roles
5. Always document decisions
6. Never overstep your authority
7. Never make unilateral decisions
8. Always follow the decision engine
9. Always verify feature preservation
10. Always communicate with the team
