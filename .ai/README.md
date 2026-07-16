# KMJ Optical ERP - Engineering Knowledge Base

## Purpose

This directory contains the complete engineering operating system (EOS) for the KMJ Optical ERP project. Every AI coding agent and human engineer must read and follow these documents before making any changes to the codebase.

## Directory Structure

```
.ai/
  README.md                    # This file - navigation and overview
  AGENTS.md                    # AI agent hierarchy and decision engine
  PROJECT.md                   # Complete project specification
  docs/                        # Engineering documentation (47 documents)
    00-project-overview.md     # Project overview and business context
    01-engineering-principles.md
    02-software-philosophy.md
    03-clean-architecture.md
    04-folder-structure.md
    05-coding-standards.md
    06-naming-conventions.md
    07-backend.md
    08-frontend.md
    09-react.md
    10-node.md
    11-express.md
    12-database.md
    13-mongodb.md
    14-api-design.md
    15-authentication.md
    16-authorization.md
    17-rbac.md
    18-validation.md
    19-error-handling.md
    20-logging.md
    21-performance.md
    22-security.md
    23-testing.md
    24-caching.md
    25-file-storage.md
    26-event-driven-design.md
    27-background-jobs.md
    28-feature-preservation.md
    29-refactoring.md
    30-code-review.md
    31-git-workflow.md
    32-branch-strategy.md
    33-documentation.md
    34-ui-design-system.md
    35-accessibility.md
    36-deployment.md
    37-monitoring.md
    38-observability.md
    39-analytics.md
    40-anti-patterns.md
    41-checklists.md
    42-decision-engine.md
    43-ai-workflow.md
    44-ai-review-process.md
    45-ai-team.md
    46-principles-for-future.md
  patterns/                    # Reusable code patterns
    api-patterns.md
    react-patterns.md
    backend-patterns.md
    database-patterns.md
    security-patterns.md
    performance-patterns.md
  templates/                   # Code templates for common tasks
    new-feature.md
    bug-fix.md
    refactor.md
    api.md
    component.md
    service.md
    repository.md
    controller.md
    migration.md
  checklists/                  # Pre-flight checklists
    backend.md
    frontend.md
    api.md
    database.md
    deployment.md
    release.md
    security.md
    testing.md
  knowledge/                   # Project knowledge base
    business-domains.md
    feature-map.md
    dependency-map.md
    architecture-map.md
    data-flow.md
```

## How to Use This Knowledge Base

### For AI Agents

1. **FIRST**: Read `AGENTS.md` to understand your role and decision process
2. **SECOND**: Read `PROJECT.md` to understand the complete project
3. **THIRD**: Read the specific document for your task (e.g., `docs/07-backend.md` for backend work)
4. **ALWAYS**: Follow the checklists in `checklists/` before completing any task
5. **NEVER**: Skip the feature preservation rules in `docs/28-feature-preservation.md`

### For Human Engineers

1. Read `docs/00-project-overview.md` for business context
2. Read `docs/01-engineering-principles.md` for core values
3. Read the document relevant to your current task
4. Use `checklists/` as quality gates
5. Reference `patterns/` for implementation guidance

## Key Rules

1. **Business logic is sacred** - Never rewrite without explicit instruction
2. **Feature preservation** - Every refactor must prove feature parity
3. **Architecture first** - Design before implementation
4. **Security always** - Never compromise security for convenience
5. **Documentation required** - Every decision must be documented

## Document Cross-References

Each document in `docs/` includes cross-references to related documents. Use these to navigate the knowledge base. The documents are designed to be read independently but provide maximum value when read together.

## Maintenance

This knowledge base must be updated when:
- New features are added
- Architecture changes
- New patterns are established
- Lessons are learned
- Anti-patterns are discovered

Every update must be reviewed by the Chief Architect role (see `AGENTS.md`).
