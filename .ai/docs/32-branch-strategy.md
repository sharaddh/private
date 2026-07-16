# 32 - Branch Strategy

## Purpose

This document defines the branch strategy for the KMJ Optical ERP project, including branch types, naming conventions, merge conflicts resolution, and release management.

## Core Principles

1. **Main is always deployable**: The `main` branch must always be in a deployable state.
2. **Feature isolation**: Each feature gets its own branch to avoid conflicts.
3. **Short-lived branches**: Branches should be merged within 1-3 days.
4. **Clean history**: Rebase before merging to maintain linear history.
5. **Protected main**: Direct commits to `main` are prohibited.

## Detailed Rules

### Branch Types

```
main (production)
  │
  ├── develop (integration)
  │     │
  │     ├── feat/customer-notes
  │     ├── feat/order-tracking
  │     └── fix/status-transition
  │
  ├── release/v1.2.0
  │
  └── hotfix/fix-data-loss
```

#### Main Branch

**Purpose**: Production-ready code

**Rules**:
1. Never commit directly to `main`
2. Always merge via PR with approval
3. Always merge from `release/*` or `hotfix/*`
4. Always tag releases on `main`
5. Always deploy from `main`

**Protection**:
- Require PR for all changes
- Require at least 1 approval
- Require CI to pass
- Require up-to-date branch

#### Develop Branch

**Purpose**: Integration branch for ongoing development

**Rules**:
1. Merge feature branches into `develop`
2. Always rebase feature branches before merging
3. Always run tests before merging
4. Never merge broken code into `develop`
5. Always keep `develop` in sync with `main`

**Workflow**:
```bash
# Merge feature branch into develop
git checkout develop
git merge --squash feat/customer-notes
git commit -m "feat(customers): add customer notes"

# Keep develop in sync with main
git checkout develop
git rebase main
```

#### Feature Branches

**Purpose**: Isolated development of new features

**Naming**:
```
feat/<short-description>
```

**Rules**:
1. Always create from `develop` (or `main` for urgent features)
2. Always use descriptive names
3. Always rebase on `develop` before merging
4. Always squash and merge into `develop`
5. Always delete after merging

**Lifecycle**:
```bash
# Create feature branch
git checkout develop
git checkout -b feat/add-customer-notes

# Work on feature
git add .
git commit -m "feat(customers): add notes field to schema"
git commit -m "feat(customers): add notes API endpoint"
git commit -m "feat(customers): add notes UI component"

# Rebase before merge
git fetch origin
git rebase origin/develop

# Push and create PR
git push origin feat/add-customer-notes

# After approval, merge and delete
git checkout develop
git merge --squash feat/add-customer-notes
git push origin develop
git branch -d feat/add-customer-notes
```

#### Release Branches

**Purpose**: Prepare releases

**Naming**:
```
release/v<version>
```

**Rules**:
1. Always create from `develop`
2. Always only fix release-blocking bugs
3. Always update version numbers
4. Always update CHANGELOG.md
5. Always merge into both `main` and `develop`

**Lifecycle**:
```bash
# Create release branch
git checkout develop
git checkout -b release/v1.2.0

# Fix release-blocking bugs
git commit -m "fix: resolve payment calculation edge case"

# Update version numbers
# Edit package.json, CHANGELOG.md

# Merge into main
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"

# Merge into develop
git checkout develop
git merge --no-ff release/v1.2.0

# Delete release branch
git branch -d release/v1.2.0
```

#### Hotfix Branches

**Purpose**: Critical production fixes

**Naming**:
```
hotfix/<short-description>
```

**Rules**:
1. Always create from `main`
2. Always fix critical issues only
3. Always include regression tests
4. Always merge into both `main` and `develop`
5. Always tag hotfix releases

**Lifecycle**:
```bash
# Create hotfix branch
git checkout main
git checkout -b hotfix/fix-data-loss-bug

# Fix the issue
git commit -m "fix(auth): correct token validation"
git commit -m "test(auth): add regression test"

# Merge into main
git checkout main
git merge --no-ff hotfix/fix-data-loss-bug
git tag -a v1.2.1 -m "Hotfix v1.2.1"

# Merge into develop
git checkout develop
git merge --no-ff hotfix/fix-data-loss-bug

# Delete hotfix branch
git branch -d hotfix/fix-data-loss-bug
```

### Merge Conflicts Resolution

#### Prevention

1. **Small, focused branches**: Reduce conflict surface area
2. **Frequent rebasing**: Stay up-to-date with target branch
3. **Clear ownership**: Avoid multiple engineers editing same files
4. **Modular code**: Reduce coupling between components

#### Resolution Process

```bash
# 1. Start rebase
git checkout feat/add-customer-notes
git fetch origin
git rebase origin/develop

# 2. If conflicts occur
# Git will pause and show conflicted files

# 3. Resolve conflicts in each file
# Edit files to resolve conflicts
# Look for <<<<<<< HEAD markers

# 4. Stage resolved files
git add <resolved-file>

# 5. Continue rebase
git rebase --continue

# 6. If rebase gets too complex, abort
git rebase --abort
```

#### Conflict Resolution Guidelines

1. **Understand both changes**: Read both sides of the conflict
2. **Preserve intent**: Keep the intent of both changes
3. **Test after resolution**: Run tests to verify correctness
4. **Ask for help**: If unsure, ask the original author
5. **Document complex resolutions**: Add comments explaining why

```typescript
// Conflict example
<<<<<<< HEAD (develop)
const customer = await Customer.findById(id);
if (!customer) {
  throw new AppError(404, 'Customer not found');
}
return customer;
=======
const customer = await Customer.findById(id).lean();
if (!customer) {
  throw new AppError(404, 'Customer not found');
}
return customer;
>>>>>>> feat/add-customer-notes

// Resolution: Keep the lean() optimization from the feature branch
const customer = await Customer.findById(id).lean();
if (!customer) {
  throw new AppError(404, 'Customer not found');
}
return customer;
```

### Branch Cleanup

#### Automatic Cleanup

```bash
# Delete merged local branches
git branch --merged develop | grep -v develop | xargs git branch -d

# Delete merged remote branches
git fetch --prune
git branch -r --merged develop | grep -v develop | sed 's/origin\///' | xargs -I {} git push origin --delete {}
```

#### Manual Cleanup

```bash
# Delete specific branch
git branch -d feat/add-customer-notes
git push origin --delete feat/add-customer-notes

# Delete unmerged branch (use with caution)
git branch -D feat/abandoned-feature
git push origin --delete feat/abandoned-feature
```

### Emergency Procedures

#### Data Loss Bug

```
1. Stop all other work
2. Create hotfix branch from main
3. Fix the issue
4. Write regression test
5. Get expedited review
6. Merge to main
7. Deploy immediately
8. Verify fix
9. Post-mortem
```

#### Security Vulnerability

```
1. Assess severity
2. Create hotfix branch from main
3. Fix the vulnerability
4. Security Engineer review
5. Merge to main
6. Deploy immediately
7. Verify fix
8. Notify stakeholders
9. Document incident
```

## Bad Examples

```bash
# BAD: Long-lived feature branch
git checkout -b feat/big-feature
# 3 weeks later, 200 commits behind develop
# Massive merge conflicts

# BAD: Direct commits to main
git checkout main
git commit -m "quick fix"  # Bypasses review!

# BAD: Messy branch names
git checkout -b john-work
git checkout -b temp-branch
git checkout -b feature123
```

## Good Examples

```bash
# GOOD: Short-lived feature branch
git checkout -b feat/add-customer-notes
# 2 days later, 3 commits, merged and deleted

# GOOD: Clean rebase before merge
git checkout feat/add-customer-notes
git fetch origin
git rebase origin/develop
# Resolve any conflicts
git push origin feat/add-customer-notes
# Create PR, get approval, merge

# GOOD: Proper release branch
git checkout -b release/v1.2.0
# Fix release bugs only
# Update version numbers
# Merge to main and develop
# Delete branch
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Protected main | Prevents broken code in production | Slows down emergency fixes |
| Squash and merge | Clean history | Loses individual commit context |
| Short-lived branches | Reduces merge conflicts | Requires frequent rebase |
| Release branches | Controlled releases | More branches to manage |
| Hotfix branches | Fast production fixes | Additional branch type |

## Cross-References

- **Git workflow**: See `docs/31-git-workflow.md`
- **Code review**: See `docs/30-code-review.md`
- **Deployment**: See `docs/36-deployment.md`
- **CI/CD**: See `docs/36-deployment.md`
- **Emergency procedures**: See `docs/41-checklists.md`

## AI Instructions

When working with branches:
1. Always create feature branches from `develop`
2. Always use descriptive branch names
3. Always rebase before merging
4. Always squash and merge feature branches
5. Always delete branches after merging
6. Never commit directly to `main`
7. Never merge broken code
8. Always resolve conflicts carefully
9. Always run tests after resolving conflicts
10. Always keep `develop` in sync with `main`
