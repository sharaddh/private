# 42 - Decision Engine

## Purpose

This document defines the decision engine for the KMJ Optical ERP project, including decision trees for common scenarios, architecture decision records (ADRs), and tradeoff analysis. The decision engine ensures consistent, well-reasoned decisions.

## Core Principles

1. **Systematic approach**: Follow the decision engine for all significant decisions.
2. **Documented decisions**: All decisions must be documented in ADRs.
3. **Tradeoff analysis**: Every decision has tradeoffs—analyze them explicitly.
4. **Reversibility**: Prefer reversible decisions when possible.
5. **Stakeholder impact**: Consider impact on all stakeholders.

## Detailed Rules

### Decision Tree for Common Scenarios

#### Scenario: Adding a New Feature

```
New Feature Request
     │
     ▼
1. Does this feature already exist?
   ├── YES → Stop. Inform user.
   └── NO → Continue
            │
            ▼
2. Does this feature conflict with existing features?
   ├── YES → Design conflict resolution
   └── NO → Continue
            │
            ▼
3. Does this feature require database changes?
   ├── YES → Database Architect review
   └── NO → Continue
            │
            ▼
4. Does this feature require API changes?
   ├── YES → Backend Architect review
   └── NO → Continue
            │
            ▼
5. Does this feature require UI changes?
   ├── YES → Frontend Architect review
   └── NO → Continue
            │
            ▼
6. Does this feature affect security?
   ├── YES → Security Engineer review
   └── NO → Continue
            │
            ▼
7. Does this feature affect performance?
   ├── YES → Performance Engineer review
   └── NO → Continue
            │
            ▼
8. Implement feature
   ├── Follow templates in .ai/templates/
   ├── Follow patterns in .ai/patterns/
   └── Follow checklists in .ai/checklists/
            │
            ▼
9. Review implementation
   ├── Run all tests
   ├── Verify feature preservation
   └── Update documentation
```

#### Scenario: Fixing a Bug

```
Bug Report
     │
     ▼
1. Is this a security bug?
   ├── YES → Security Engineer review immediately
   └── NO → Continue
            │
            ▼
2. Is this a data loss bug?
   ├── YES → Stop all other work, fix immediately
   └── NO → Continue
            │
            ▼
3. Reproduce the bug
   ├── Write failing test
   └── Document reproduction steps
            │
            ▼
4. Identify root cause
   ├── Is this a code bug?
   ├── Is this a design bug?
   ├── Is this a configuration bug?
   └── Is this a data bug?
            │
            ▼
5. Fix the bug
   ├── Minimal change to fix
   ├── Don't refactor while fixing
   └── Don't add features while fixing
            │
            ▼
6. Verify fix
   ├── Test passes
   ├── No regressions
   └── Feature preservation verified
```

#### Scenario: Refactoring Code

```
Refactoring Request
     │
     ▼
1. What is the motivation for this refactoring?
   ├── Performance? → Performance Engineer review
   ├── Maintainability? → Reviewer review
   ├── Readability? → Reviewer review
   └── Technical debt? → Chief Architect review
            │
            ▼
2. What features does this code support?
   ├── List all features
   ├── List all API contracts
   ├── List all data flows
   └── List all dependencies
            │
            ▼
3. Can this refactoring break any features?
   ├── YES → Design safe refactoring strategy
   └── NO → Continue
            │
            ▼
4. Implement refactoring
   ├── Make small, incremental changes
   ├── Run tests after each change
   ├── Verify feature preservation at each step
   └── Document what changed and why
            │
            ▼
5. Verify refactoring
   ├── All tests pass
   ├── All features preserved
   ├── No performance regression
   └── Documentation updated
```

#### Scenario: Choosing a Technology

```
Technology Choice
     │
     ▼
1. What problem does this technology solve?
   ├── Document the problem clearly
   └── Define success criteria
            │
            ▼
2. What are the alternatives?
   ├── List all viable options
   └── Research each option
            │
            ▼
3. What are the tradeoffs?
   ├── Performance
   ├── Cost
   ├── Learning curve
   ├── Maintenance burden
   ├── Community support
   └── Integration complexity
            │
            ▼
4. Does this technology align with existing stack?
   ├── YES → Prefer this technology
   └── NO → Strong justification needed
            │
            ▼
5. What is the migration path?
   ├── Can we adopt incrementally?
   ├── Can we rollback if needed?
   └── What is the migration cost?
            │
            ▼
6. Document decision in ADR
   ├── Context
   ├── Decision
   ├── Consequences
   └── Alternatives considered
```

### Architecture Decision Records (ADR)

#### ADR Template

```markdown
# ADR-001: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[What is the issue that we're seeing that is motivating this decision or change?]

## Decision

[What is the change that we're proposing and/or doing?]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Cost 1]
- [Cost 2]

### Risks
- [Risk 1]
- [Risk 2]

## Alternatives Considered

### Alternative 1: [Name]
- Description: [What it is]
- Pros: [Advantages]
- Cons: [Disadvantages]
- Why rejected: [Reason]

### Alternative 2: [Name]
- Description: [What it is]
- Pros: [Advantages]
- Cons: [Disadvantages]
- Why rejected: [Reason]

## References

- [Link to related documentation]
- [Link to related ADRs]
```

#### Example ADR

```markdown
# ADR-001: Use MongoDB for Primary Database

## Status

Accepted

## Context

The KMJ Optical ERP needs a primary database to store customer, order, and billing data. The system requires:
- Flexible schema for evolving business requirements
- Good performance for read-heavy workloads
- Easy horizontal scaling for multi-branch architecture
- Strong community support and mature ecosystem

## Decision

Use MongoDB as the primary database with Mongoose ODM for schema definition and validation.

## Consequences

### Positive
- Flexible schema allows rapid iteration
- Excellent performance for read operations
- Native support for multi-tenant architecture (database per branch)
- Strong community and ecosystem
- Good TypeScript support via Mongoose

### Negative
- No JOIN support (requires multiple queries or aggregation)
- Eventual consistency by default (requires careful design)
- Memory usage can be high for large datasets
- Learning curve for team members familiar with SQL

### Risks
- Schema design mistakes can be costly to fix
- Aggregation pipelines can be complex
- Need to manage connection pooling carefully

## Alternatives Considered

### Alternative 1: PostgreSQL
- Description: Relational database with strong ACID guarantees
- Pros: Strong consistency, JOIN support, mature ecosystem
- Cons: Rigid schema, harder to scale horizontally, more complex setup
- Why rejected: Less flexible for evolving business requirements

### Alternative 2: MySQL
- Description: Popular relational database
- Pros: Fast, reliable, large community
- Cons: Similar to PostgreSQL but less feature-rich
- Why rejected: Same reasons as PostgreSQL

## References

- MongoDB documentation: https://docs.mongodb.com/
- Mongoose documentation: https://mongoosejs.com/
- Project database architecture: docs/12-database.md
```

### Tradeoff Analysis

#### Performance vs. Maintainability

| Decision | Performance | Maintainability |
|----------|-------------|-----------------|
| Denormalized data | Fast reads | Complex writes |
| Indexed queries | Fast queries | Slower writes |
| Caching | Fast responses | Cache invalidation complexity |
| Aggregation pipelines | Complex queries | Hard to maintain |

#### Speed vs. Quality

| Decision | Speed | Quality |
|----------|-------|---------|
| Skip tests | Faster development | More bugs |
| Skip code review | Faster delivery | Lower quality |
| Skip documentation | Faster onboarding | Harder maintenance |
| Skip refactoring | Faster features | Technical debt |

#### Simplicity vs. Flexibility

| Decision | Simplicity | Flexibility |
|----------|------------|-------------|
| Monolith | Easy to deploy | Hard to scale |
| Single database | Easy to manage | Hard to isolate |
| Hardcoded config | Easy to understand | Hard to change |
| No abstraction | Easy to read | Hard to refactor |

### Decision Criteria

#### For Technical Decisions

1. **Does this preserve all existing features?**
2. **Does this maintain backward compatibility?**
3. **Does this align with the long-term architecture?**
4. **Does this introduce new technical debt?**
5. **Is the risk acceptable?**
6. **Can this be reversed if needed?**
7. **What is the migration path?**

#### For Business Decisions

1. **What business value does this provide?**
2. **What business rules govern this change?**
3. **What business workflows are affected?**
4. **What business data is affected?**
5. **What business reports are affected?**
6. **What business permissions are affected?**
7. **What business audit logs are affected?**

## Bad Examples

```markdown
# BAD: Undocumented decision
"We decided to use Redis for caching because it's fast."

# BAD: No alternatives considered
"Chose MongoDB because that's what we know."

# BAD: No tradeoff analysis
"Implemented caching. It's faster now."
```

## Good Examples

```markdown
# GOOD: Documented decision with tradeoffs
## Decision: Implement Redis caching for API responses

### Context
API response times are slow for frequently accessed endpoints.

### Alternatives Considered
1. **In-memory caching**: Simple but lost on restart
2. **Redis caching**: Distributed, persistent, fast
3. **Database caching**: No additional infrastructure

### Tradeoffs
- Redis adds infrastructure complexity
- Redis adds deployment complexity
- Redis adds monitoring complexity
- But provides significant performance improvement

### Decision
Implement Redis caching with branch-aware cache keys.

### Consequences
- Response times improve by 80%
- Additional infrastructure to maintain
- Cache invalidation logic required
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Documented decisions | Consistent decisions | More documentation |
| Tradeoff analysis | Informed decisions | More analysis time |
| ADRs | Decision history | More documentation |
| Decision trees | Systematic decisions | More process overhead |
| Reversible decisions | Easy rollback | May be less optimal |

## Cross-References

- **Architecture**: See `docs/03-clean-architecture.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`
- **Refactoring**: See `docs/29-refactoring.md`
- **Code review**: See `docs/30-code-review.md`
- **AI workflow**: See `docs/43-ai-workflow.md`

## AI Instructions

When making decisions:
1. Always follow the decision engine
2. Always document decisions in ADRs
3. Always analyze tradeoffs explicitly
4. Always consider reversibility
5. Always consider stakeholder impact
6. Never make undocumented decisions
7. Never skip alternatives analysis
8. Always verify feature preservation
9. Always document consequences
10. Always update documentation with decisions
