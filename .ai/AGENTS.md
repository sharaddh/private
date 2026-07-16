# AGENTS.md - AI Agent Operating System

## Purpose

This document defines the complete AI agent hierarchy, decision engine, and operating procedures for the KMJ Optical ERP project. Every AI coding agent (OpenCode, Claude Code, Codex, Gemini CLI, Roo Code, Cline, Cursor, Aider) must follow this document exactly.

This is the brain of the project. It governs every decision, every code change, and every review.

## AI Agent Hierarchy

### Organizational Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Chief Architect                           │
│            (Final authority on all decisions)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │Backend  │      │Frontend │      │Database │
    │Architect│      │Architect│      │Architect│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │Security │      │  QA     │      │Performance│
    │Engineer │      │Engineer │      │ Engineer │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Reviewer  │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │Docs Engineer│
                    └───────────┘
```

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

## Decision Engine

### Request Processing Flow

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: UNDERSTAND                                         │
│ ─────────────────                                           │
│ 1. Read the request completely                              │
│ 2. Identify the type of change (feature/bugfix/refactor)    │
│ 3. Identify the affected components (frontend/backend/db)   │
│ 4. Identify the scope (files, endpoints, models)            │
│ 5. Ask clarifying questions if needed                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: READ DEPENDENCIES                                  │
│ ────────────────────────                                    │
│ 1. Read all files that will be affected                     │
│ 2. Read all files that depend on affected files             │
│ 3. Read all tests that cover affected code                  │
│ 4. Read all documentation for affected features             │
│ 5. Read AGENTS.md and PROJECT.md if not already read        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: BUSINESS ANALYSIS                                  │
│ ──────────────────────────                                  │
│ 1. What business value does this provide?                   │
│ 2. What business rules govern this change?                  │
│ 3. What business workflows are affected?                    │
│ 4. What business data is affected?                          │
│ 5. What business reports are affected?                      │
│ 6. What business permissions are affected?                  │
│ 7. What business audit logs are affected?                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: ARCHITECTURE ANALYSIS                              │
│ ──────────────────────────────                              │
│ 1. What architectural patterns are affected?                │
│ 2. What architectural principles apply?                     │
│ 3. What architectural tradeoffs exist?                      │
│ 4. What architectural risks exist?                          │
│ 5. What architectural benefits exist?                       │
│ 6. Does this align with the long-term vision?               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: RISK ANALYSIS                                      │
│ ────────────────────────                                    │
│ 1. What features might break?                               │
│ 2. What data might be lost?                                 │
│ 3. What APIs might change?                                  │
│ 4. What permissions might be affected?                      │
│ 5. What audit logs might be affected?                       │
│ 6. What reports might be affected?                          │
│ 7. What workflows might be affected?                        │
│ 8. What is the rollback plan?                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: IMPLEMENTATION PLAN                                │
│ ────────────────────────────                                │
│ 1. List all files to create/modify                          │
│ 2. List all changes in order                                │
│ 3. List all tests to write                                  │
│ 4. List all documentation to update                         │
│ 5. List all checkpoints for verification                    │
│ 6. Estimate complexity and risk                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 7: REVIEW                                             │
│ ─────────────────                                           │
│ 1. Chief Architect review (if architectural change)         │
│ 2. Backend Architect review (if backend change)             │
│ 3. Frontend Architect review (if frontend change)           │
│ 4. Database Architect review (if database change)           │
│ 5. Security Engineer review (if security change)            │
│ 6. Performance Engineer review (if performance change)      │
│ 7. QA Engineer review (if quality concern)                  │
│ 8. Reviewer review (all changes)                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 8: TESTING                                            │
│ ─────────────────                                           │
│ 1. Unit tests for new code                                  │
│ 2. Integration tests for new features                       │
│ 3. Regression tests for affected features                   │
│ 4. Edge case tests                                          │
│ 5. Error scenario tests                                     │
│ 6. Performance tests (if applicable)                        │
│ 7. Security tests (if applicable)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 9: VERIFICATION                                       │
│ ────────────────────────                                    │
│ 1. Run all tests                                            │
│ 2. Verify all features still work                           │
│ 3. Verify all APIs still work                               │
│ 4. Verify all permissions still work                        │
│ 5. Verify all audit logs still work                         │
│ 6. Verify all reports still work                            │
│ 7. Verify all workflows still work                          │
│ 8. Verify no regressions                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 10: DOCUMENTATION                                     │
│ ────────────────────────                                    │
│ 1. Update all affected documentation                        │
│ 2. Add inline comments for complex logic                    │
│ 3. Update API documentation                                 │
│ 4. Update architecture documentation                        │
│ 5. Update README if needed                                  │
│ 6. Update CHANGELOG if needed                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                      ┌─────────┐
                      │   DONE   │
                      └─────────┘
```

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

## Feature Preservation Rules

### Absolute Rules (NEVER violate)

1. **NEVER remove functionality** unless explicitly instructed by the Chief Architect
2. **NEVER simplify business logic** unless explicitly instructed by the Chief Architect
3. **NEVER change API contracts** without versioning and migration plan
4. **NEVER change database schema** without migration plan and rollback
5. **NEVER remove permissions** unless explicitly instructed by the Security Engineer
6. **NEVER remove audit logs** unless explicitly instructed by the Chief Architect
7. **NEVER remove reports** unless explicitly instructed by the Chief Architect
8. **NEVER remove validations** unless explicitly instructed by the Chief Architect
9. **NEVER remove events** unless explicitly instructed by the Chief Architect
10. **NEVER remove WhatsApp integrations** unless explicitly instructed by the Chief Architect

### Refactoring Requirements

Every refactor MUST prove feature parity by:

1. **API Parity**: All existing endpoints return same data
2. **Database Parity**: All existing data is preserved
3. **UI Parity**: All existing pages look and work the same
4. **Permission Parity**: All existing access controls work the same
5. **Report Parity**: All existing reports show same data
6. **Audit Parity**: All existing audit logs are generated
7. **Workflow Parity**: All existing workflows complete successfully

### Proof of Feature Parity

Before completing any refactoring, you MUST:

1. Run all existing tests
2. Write new tests for any untested code affected
3. Verify all API endpoints return same responses
4. Verify all database queries return same results
5. Verify all UI pages render correctly
6. Verify all permissions are enforced
7. Verify all audit logs are generated
8. Verify all reports show correct data
9. Document all changes in the commit message
10. Update all affected documentation

## AI-Specific Instructions

### Before Starting Any Task

1. **Read AGENTS.md** (this document) - Understand your role and process
2. **Read PROJECT.md** - Understand the complete project
3. **Read the relevant docs/ file** - Understand the specific area
4. **Read the relevant patterns/ file** - Understand the patterns to follow
5. **Read the relevant templates/ file** - Understand the templates to use
6. **Read the relevant checklists/ file** - Understand the quality gates

### During Any Task

1. **Follow the decision engine** - Go through all phases
2. **Ask questions** - If anything is unclear, ask the user
3. **Make small changes** - Don't make large changes at once
4. **Test frequently** - Run tests after each change
5. **Document as you go** - Don't wait until the end

### After Completing Any Task

1. **Run all tests** - Ensure nothing is broken
2. **Verify feature preservation** - Ensure all features still work
3. **Update documentation** - Ensure all changes are documented
4. **Update checklists** - Ensure all quality gates are passed
5. **Report to user** - Summarize what was done and any concerns

### Code Generation Rules

1. **Never generate code that violates existing patterns**
2. **Never generate code that introduces anti-patterns**
3. **Never generate code that removes features**
4. **Never generate code that changes API contracts**
5. **Never generate code that changes database schema**
6. **Never generate code that changes permissions**
7. **Never generate code that changes audit logging**
8. **Never generate code that changes WhatsApp integration**
9. **Always generate TypeScript** - Never plain JavaScript
10. **Always generate typed code** - Never use `any` type

### Review Checklist for AI Agents

Before submitting any code change, verify:

- [ ] All existing tests pass
- [ ] New tests written for new code
- [ ] No `any` types used
- [ ] All functions have return types
- [ ] All inputs are validated
- [ ] All errors are handled
- [ ] All edge cases are handled
- [ ] All naming conventions followed
- [ ] All coding standards followed
- [ ] All documentation updated
- [ ] Feature preservation verified
- [ ] No anti-patterns introduced
- [ ] No security issues introduced
- [ ] No performance issues introduced
- [ ] No accessibility issues introduced

## Conflict Resolution

### When Roles Disagree

1. **Backend vs Frontend**: Chief Architect decides
2. **Security vs Performance**: Security wins
3. **Quality vs Speed**: Quality wins (unless hotfix)
4. **Feature vs Refactoring**: Feature wins (unless critical refactoring)
5. **New vs Legacy**: Legacy wins (unless legacy is broken)

### When to Escalate

Escalate to Chief Architect when:
- You're unsure about architectural decisions
- You're unsure about feature preservation
- You're unsure about security implications
- You're unsure about performance implications
- You're unsure about business logic
- You're unsure about deployment impact

## Emergency Procedures

### Critical Bug (Data Loss or Security)

1. **Stop all other work**
2. **Fix the bug immediately**
3. **Write tests to prevent regression**
4. **Document the fix**
5. **Deploy the fix**
6. **Notify all stakeholders**
7. **Conduct post-mortem**

### Production Incident

1. **Assess the impact**
2. **Notify stakeholders**
3. **Identify root cause**
4. **Implement fix**
5. **Test fix**
6. **Deploy fix**
7. **Verify fix**
8. **Document incident**
9. **Conduct post-mortem**
10. **Update monitoring**

## Communication Protocol

### When to Ask Questions

- Before starting any task that affects multiple components
- Before starting any task that changes API contracts
- Before starting any task that changes database schema
- Before starting any task that changes authentication/authorization
- Before starting any task that changes WhatsApp integration
- Before starting any task that changes the multi-tenant architecture

### How to Ask Questions

1. **Be specific** - Don't ask vague questions
2. **Provide context** - Explain what you've already understood
3. **Explain your thinking** - Show what you've already considered
4. **Ask for confirmation** - Don't assume the answer
5. **Document the answer** - Write it down for future reference

### When to Provide Updates

- After completing each phase of the decision engine
- After discovering any issues
- After making any significant decisions
- After completing any significant changes
- Before asking for review

## Continuous Improvement

### Learning from Mistakes

1. **Document mistakes** - Write them down
2. **Analyze root cause** - Why did this happen?
3. **Update procedures** - How can we prevent this?
4. **Share knowledge** - Tell other agents
5. **Update documentation** - Ensure it doesn't happen again

### Improving Processes

1. **Identify pain points** - What's slowing us down?
2. **Propose solutions** - How can we improve?
3. **Test solutions** - Do they actually help?
4. **Implement solutions** - Roll out improvements
5. **Measure impact** - Did it actually help?

### Maintaining Quality

1. **Regular audits** - Check code quality regularly
2. **Update standards** - Keep coding standards current
3. **Update patterns** - Keep patterns current
4. **Update templates** - Keep templates current
5. **Update checklists** - Keep checklists current

## Version Control

### Commit Messages

Follow this format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance
- `perf`: Performance
- `security`: Security fix

Scope: The component affected (auth, customers, orders, bills, payments, inventory, delivery, dashboard, reports, settings, whatsapp, workspace)

Subject: Imperative mood, lowercase, no period

Body: What and why (not how)

Footer: Breaking changes, issue references

### Branch Naming

```
<type>/<short-description>
```

Examples:
- `feat/add-customer-notes`
- `fix/order-status-transition`
- `refactor/extract-payment-service`
- `docs/update-api-documentation`
- `test/add-order-integration-tests`

### Pull Request Description

```
## What

Brief description of changes

## Why

Why these changes are needed

## How

How the changes were implemented

## Testing

How the changes were tested

## Feature Preservation

Proof that all existing features still work

## Documentation

What documentation was updated
```
