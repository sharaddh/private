# 31 - Git Workflow

## Purpose

This document defines the Git workflow for the KMJ Optical ERP project, including commit conventions, branch naming, pull request process, merge strategy, and release process.

## Core Principles

1. **Atomic commits**: Each commit should represent one logical change.
2. **Conventional commits**: All commit messages follow the Conventional Commits specification.
3. **Clean history**: Rebase feature branches to maintain linear history.
4. **Traceability**: Every change links to a reason (issue, feature, bug).
5. **Reviewability**: Every change goes through code review before merge.

## Detailed Rules

### Commit Conventions

#### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(customers): add customer notes` |
| `fix` | Bug fix | `fix(orders): correct status transition` |
| `refactor` | Code refactoring | `refactor(auth): extract token service` |
| `docs` | Documentation | `docs(api): update customer endpoints` |
| `test` | Tests | `test(orders): add integration tests` |
| `chore` | Maintenance | `chore(deps): update dependencies` |
| `perf` | Performance | `perf(queries): add compound index` |
| `security` | Security fix | `security(auth): fix token validation` |

#### Scope

The scope is the component affected:

- `auth` - Authentication and authorization
- `customers` - Customer management
- `orders` - Order processing
- `bills` - Billing and invoicing
- `payments` - Payment processing
- `inventory` - Inventory management
- `delivery` - Delivery tracking
- `dashboard` - Dashboard and analytics
- `reports` - Report generation
- `settings` - System settings
- `whatsapp` - WhatsApp integration
- `workspace` - Multi-branch workspace
- `api` - API layer
- `ui` - User interface
- `db` - Database
- `ci` - CI/CD
- `deps` - Dependencies

#### Subject Rules

- Use imperative mood ("add" not "added")
- Use lowercase (no capitalization)
- No period at the end
- Max 72 characters

#### Body Rules

- Explain what and why (not how)
- Wrap at 72 characters
- Use bullet points for multiple changes

#### Footer Rules

- Reference issues: `Closes #123`
- Note breaking changes: `BREAKING CHANGE: description`

#### Examples

```
feat(customers): add customer notes and visit history

- Add notes field to customer schema
- Add visit history endpoint
- Add UI component for viewing notes
- Update API documentation

Closes #45
```

```
fix(orders): correct status transition validation

The Draft → Delivered transition was incorrectly allowed.
Now only valid transitions are permitted per business rules.

Fixes #67
```

```
refactor(auth): extract token service

Extract JWT token generation and verification into a
dedicated TokenService for better testability and reuse.

BREAKING CHANGE: Token functions moved from utils to services
```

### Branch Naming

#### Format

```
<type>/<short-description>
```

#### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat/add-customer-notes` |
| `fix` | Bug fix | `fix/order-status-transition` |
| `refactor` | Refactoring | `refactor/extract-payment-service` |
| `docs` | Documentation | `docs/update-api-documentation` |
| `test` | Tests | `test/add-order-integration-tests` |
| `chore` | Maintenance | `chore/update-dependencies` |
| `hotfix` | Critical fix | `hotfix/fix-data-loss-bug` |

#### Rules

- Use lowercase only
- Use hyphens to separate words
- Keep description under 50 characters
- Use meaningful descriptions

#### Examples

```bash
# GOOD
git checkout -b feat/add-customer-notes
git checkout -b fix/order-status-transition
git checkout -b refactor/extract-payment-service
git checkout -b hotfix/fix-data-loss-bug

# BAD
git checkout -b feature1
git checkout -b my-changes
git checkout -b fixStuff
git checkout -b john/branch
```

### Pull Request Process

#### PR Description Format

```markdown
## What

Brief description of changes.

## Why

Why these changes are needed.

## How

How the changes were implemented.

## Testing

How the changes were tested.

## Feature Preservation

Proof that all existing features still work:
- [ ] All API endpoints return same responses
- [ ] All database operations preserved
- [ ] All business rules maintained
- [ ] All permissions enforced
- [ ] All audit logs generated

## Documentation

What documentation was updated.
```

#### PR Rules

1. **One logical change per PR**: Don't mix unrelated changes
2. **Small PRs**: Keep PRs under 400 lines of changes
3. **Self-review first**: Review your own PR before requesting review
4. **Link issues**: Reference related issues in PR description
5. **Include tests**: All new code must have tests
6. **Update docs**: All changes must update relevant documentation
7. **Pass CI**: All CI checks must pass before merge
8. **Get approval**: At least one approval required before merge

#### PR Workflow

```
1. Create branch from main
2. Make changes
3. Write tests
4. Update documentation
5. Self-review PR
6. Request review
7. Address feedback
8. Get approval
9. Squash and merge
10. Delete branch
```

### Merge Strategy

#### Squash and Merge (Default)

Use squash and merge for feature branches to maintain clean history:

```bash
# After approval
git checkout main
git merge --squash feat/add-customer-notes
git commit -m "feat(customers): add customer notes and visit history"
```

**When to use**:
- Feature branches with multiple WIP commits
- Bug fix branches with investigation commits
- Refactoring branches with incremental changes

#### Rebase and Merge

Use rebase and merge for clean, linear history:

```bash
# Before merge
git checkout feat/add-customer-notes
git rebase main
git checkout main
git merge --ff-only feat/add-customer-notes
```

**When to use**:
- Small, focused changes (1-3 commits)
- Changes that benefit from individual commit history

#### Merge Commit

Use merge commit for preserving branch context:

```bash
git checkout main
git merge --no-ff feat/add-customer-notes
```

**When to use**:
- Release branches
- Hotfix branches
- When branch context is important

### Release Process

#### Version Numbering

Follow Semantic Versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

#### Release Workflow

```
1. Create release branch from main
   git checkout -b release/v1.2.0 main

2. Update version numbers
   - package.json (server)
   - package.json (client)
   - package.json (warehouse)

3. Update CHANGELOG.md
   - Add release notes
   - List all changes

4. Create PR for release branch
   - Title: "release: v1.2.0"
   - Description: Release notes

5. Get approval and merge to main

6. Tag the release
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0

7. Deploy to production
   - Render.com auto-deploys from main

8. Verify deployment
   - Check health endpoint
   - Verify all features work

9. Announce release
   - Update stakeholders
   - Document any known issues
```

#### Hotfix Process

For critical production issues:

```
1. Create hotfix branch from main
   git checkout -b hotfix/fix-data-loss-bug main

2. Fix the issue
   - Minimal change
   - Write regression test
   - Verify fix

3. Create PR for hotfix
   - Title: "hotfix: fix data loss bug"
   - Description: Impact and fix details

4. Get expedited review
   - Security Engineer review (if security issue)
   - Chief Architect review (if data issue)

5. Merge to main
   - Squash and merge

6. Tag hotfix release
   git tag -a v1.2.1 -m "Hotfix v1.2.1"
   git push origin v1.2.1

7. Deploy immediately
   - Render.com auto-deploys

8. Verify deployment
   - Check health endpoint
   - Verify fix works

9. Post-mortem
   - Document root cause
   - Document prevention measures
   - Update monitoring
```

## Bad Examples

```bash
# BAD: Non-descriptive commit messages
git commit -m "fix stuff"
git commit -m "update"
git commit -m "WIP"
git commit -m "asdfghjkl"

# BAD: Non-descriptive branch names
git checkout -b branch1
git checkout -b my-changes
git checkout -b temp

# BAD: Large PRs
# PR that changes 2000 lines across 30 files
# Mixed concerns: feature + refactor + bug fix
```

## Good Examples

```bash
# GOOD: Descriptive commits
git commit -m "feat(customers): add customer notes and visit history"
git commit -m "fix(orders): correct status transition validation"
git commit -m "refactor(auth): extract token service"
git commit -m "docs(api): update customer endpoints"

# GOOD: Descriptive branches
git checkout -b feat/add-customer-notes
git checkout -b fix/order-status-transition
git checkout -b refactor/extract-payment-service

# GOOD: Focused PRs
# PR 1: "Add customer notes field to schema" (50 lines)
# PR 2: "Add customer notes API endpoint" (80 lines)
# PR 3: "Add customer notes UI component" (120 lines)
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Conventional commits | Clean, searchable history | More effort in commit messages |
| Squash and merge | Clean main branch history | Loses individual commit history |
| Small PRs | Easier review, less risk | More PRs to manage |
| Mandatory review | Catches issues early | Slows down development |
| Semantic versioning | Clear release communication | Requires discipline |

## Cross-References

- **Code review**: See `docs/30-code-review.md`
- **Branch strategy**: See `docs/32-branch-strategy.md`
- **Deployment**: See `docs/36-deployment.md`
- **CI/CD**: See `docs/36-deployment.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`

## AI Instructions

When working with Git:
1. Always use conventional commit messages
2. Always use descriptive branch names
3. Always create focused, small PRs
4. Always include tests in PRs
5. Always update documentation in PRs
6. Always self-review before requesting review
7. Always address review feedback promptly
8. Never force push to main
9. Never merge without approval
10. Always delete branches after merge
