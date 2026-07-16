# 43 - AI Workflow

## Purpose

This document defines how AI agents should approach tasks in the KMJ Optical ERP project, including reading documentation, understanding context, making changes, and verifying changes. Following this workflow ensures consistent, high-quality AI-generated code.

## Core Principles

1. **Read before writing**: Always understand the codebase before making changes.
2. **Small changes**: Never make large changes at once.
3. **Test-driven**: Always write tests before or alongside code changes.
4. **Feature preservation**: Always verify all features still work.
5. **Documentation**: Always document changes made.

## Detailed Rules

### Phase 1: Understanding

#### Step 1.1: Read Project Documentation

Before starting any task, read:

1. **AGENTS.md** - Understand the AI agent hierarchy and decision engine
2. **PROJECT.md** - Understand the complete project
3. **Relevant docs/ file** - Understand the specific area
4. **Relevant patterns/ file** - Understand patterns to follow
5. **Relevant templates/ file** - Understand templates to use
6. **Relevant checklists/ file** - Understand quality gates

```bash
# Read project documentation
cat .ai/AGENTS.md
cat .ai/PROJECT.md
cat .ai/docs/07-backend.md  # If working on backend
cat .ai/docs/09-react.md    # If working on frontend
```

#### Step 1.2: Understand the Task

Before writing any code:

1. **Read the request completely**
2. **Identify the type of change** (feature/bugfix/refactor)
3. **Identify affected components** (frontend/backend/db)
4. **Identify scope** (files, endpoints, models)
5. **Ask clarifying questions** if needed

```markdown
## Task Understanding

### Request
Add customer notes feature to the ERP system.

### Type of Change
New feature

### Affected Components
- Backend: New API endpoint, new model
- Frontend: New UI component
- Database: New schema field

### Scope
- Files: 5-8 files
- Endpoints: 2 new endpoints
- Models: 1 new model

### Questions
- Should notes be visible to all branch staff?
- Should notes be searchable?
- What is the maximum note length?
```

#### Step 1.3: Read Dependencies

Before making changes:

1. **Read all files** that will be affected
2. **Read all files** that depend on affected files
3. **Read all tests** that cover affected code
4. **Read all documentation** for affected features

```bash
# Find all files that import a module
grep -r "from '../models/customer'" server/src/

# Find all tests for a module
find server/src -name "*.test.ts" | xargs grep -l "CustomerService"
```

### Phase 2: Planning

#### Step 2.1: Create Implementation Plan

```markdown
## Implementation Plan

### Changes
1. Create CustomerNote model (server/src/models/customerNote.ts)
2. Create CustomerNoteService (server/src/services/customerNoteService.ts)
3. Create CustomerNoteController (server/src/controllers/customerNoteController.ts)
4. Create CustomerNote routes (server/src/routes/customerNotes.ts)
5. Add routes to main router (server/src/routes/index.ts)
6. Create CustomerNote UI component (client/src/components/CustomerNote.tsx)
7. Add to customer page (client/src/pages/CustomerDetail.tsx)
8. Write tests (server/src/__tests__/customerNotes.test.ts)

### Order of Implementation
1. Model (foundation)
2. Service (business logic)
3. Controller (HTTP layer)
4. Routes (API endpoints)
5. UI component (frontend)
6. Tests (verification)

### Verification Points
1. After model: Verify schema is correct
2. After service: Verify business logic works
3. After controller: Verify HTTP layer works
4. After routes: Verify API endpoints work
5. After UI: Verify frontend works
6. After tests: Verify all tests pass
```

#### Step 2.2: Identify Risks

```markdown
## Risk Analysis

### Risks
1. Adding new field to Customer model may affect existing queries
2. New API endpoint may conflict with existing endpoints
3. New UI component may affect existing layout

### Mitigations
1. Add field as optional with default value
2. Use unique URL path
3. Add component in isolated section

### Rollback Plan
1. Remove new field from model
2. Remove new endpoint
3. Remove new UI component
```

### Phase 3: Implementation

#### Step 3.1: Write Tests First (TDD)

```typescript
// server/src/__tests__/customerNotes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CustomerNoteService } from '../services/customerNoteService';

describe('CustomerNoteService', () => {
  let service: CustomerNoteService;

  beforeAll(() => {
    service = new CustomerNoteService();
  });

  describe('create', () => {
    it('should create a note with valid data', async () => {
      const note = await service.create({
        customerId: 'customer123',
        content: 'Test note',
        branchId: 'branch123',
      });
      expect(note.content).toBe('Test note');
    });

    it('should reject empty content', async () => {
      await expect(
        service.create({
          customerId: 'customer123',
          content: '',
          branchId: 'branch123',
        })
      ).rejects.toThrow('Content is required');
    });
  });

  describe('list', () => {
    it('should return notes for a customer', async () => {
      const notes = await service.list('customer123', 'branch123');
      expect(Array.isArray(notes)).toBe(true);
    });
  });
});
```

#### Step 3.2: Implement in Small Steps

```typescript
// Step 1: Create model
// server/src/models/customerNote.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerNote extends Document {
  customerId: mongoose.Types.ObjectId;
  content: string;
  branchId: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerNoteSchema = new Schema<ICustomerNote>({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  content: { type: String, required: true },
  branchId: { type: String, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

customerNoteSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerNote = mongoose.model<ICustomerNote>('CustomerNote', customerNoteSchema);
```

```typescript
// Step 2: Create service
// server/src/services/customerNoteService.ts
import { CustomerNote, ICustomerNote } from '../models/customerNote';
import { AppError } from '../utils/errors';

export class CustomerNoteService {
  async create(data: CreateCustomerNoteInput): Promise<ICustomerNote> {
    if (!data.content || data.content.trim().length === 0) {
      throw new AppError(400, 'Content is required');
    }
    return CustomerNote.create(data);
  }

  async list(customerId: string, branchId: string): Promise<ICustomerNote[]> {
    return CustomerNote.find({ customerId, branchId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name')
      .lean();
  }
}
```

#### Step 3.3: Run Tests After Each Change

```bash
# Run tests after each change
npm test -- --grep "CustomerNote"

# Run all tests to verify no regressions
npm test
```

### Phase 4: Verification

#### Step 4.1: Verify Feature Parity

```markdown
## Feature Parity Verification

### API Parity
- [ ] All existing endpoints return same responses
- [ ] All existing status codes preserved
- [ ] All existing authentication preserved
- [ ] All existing authorization preserved

### Database Parity
- [ ] All existing data preserved
- [ ] All existing indexes preserved
- [ ] All existing relationships preserved

### UI Parity
- [ ] All existing pages render correctly
- [ ] All existing forms work correctly
- [ ] All existing buttons work correctly

### Permission Parity
- [ ] All existing access controls work
- [ ] All existing audit logs generated
```

#### Step 4.2: Run All Tests

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

#### Step 4.3: Manual Verification

```markdown
## Manual Verification

### Backend
- [ ] API endpoints work correctly
- [ ] Error handling works correctly
- [ ] Authentication works correctly
- [ ] Authorization works correctly

### Frontend
- [ ] UI renders correctly
- [ ] Forms work correctly
- [ ] Navigation works correctly
- [ ] Loading states work correctly
- [ ] Error states work correctly
```

### Phase 5: Documentation

#### Step 5.1: Update Documentation

```markdown
## Documentation Updates

### Code Documentation
- [ ] Complex logic documented
- [ ] API endpoints documented
- [ ] Business rules documented

### API Documentation
- [ ] New endpoints documented
- [ ] Request/response formats documented
- [ ] Error formats documented

### Architecture Documentation
- [ ] New components documented
- [ ] Data flow documented
- [ ] Dependencies documented
```

#### Step 5.2: Update Changelog

```markdown
## Changelog Entry

### Added
- Customer notes feature
  - New API endpoint: POST /api/customers/:id/notes
  - New API endpoint: GET /api/customers/:id/notes
  - New UI component for viewing and adding notes
```

## AI-Specific Rules

### Code Generation Rules

1. **Never generate code that violates existing patterns**
2. **Never generate code that introduces anti-patterns**
3. **Never generate code that removes features**
4. **Never generate code that changes API contracts**
5. **Never generate code that changes database schema**
6. **Always generate TypeScript** - Never plain JavaScript
7. **Always generate typed code** - Never use `any` type
8. **Always follow naming conventions**
9. **Always include error handling**
10. **Always include input validation**

### Review Checklist for AI Agents

Before submitting any code change:

- [ ] All existing tests pass
- [ ] New tests written for new code
- [ ] No `any` types used
- [ ] All functions have return types
- [ ] All inputs are validated
- [ ] All errors are handled
- [ ] All edge cases handled
- [ ] All naming conventions followed
- [ ] All coding standards followed
- [ ] All documentation updated
- [ ] Feature preservation verified
- [ ] No anti-patterns introduced
- [ ] No security issues introduced
- [ ] No performance issues introduced
- [ ] No accessibility issues introduced

## Bad Examples

```typescript
// BAD: Making large changes without understanding
// "I'll just rewrite the entire customer service"
// This is dangerous and likely to break things!

// BAD: Not running tests
// Making changes and assuming they work
// Without verification!

// BAD: Not documenting changes
// Making changes without explaining what was done
// Future developers won't understand!
```

## Good Examples

```typescript
// GOOD: Incremental, well-tested changes
// Step 1: Add validation function
function validateCustomerNote(data: unknown): CreateCustomerNoteInput {
  const parsed = createCustomerNoteSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid note data', parsed.error.issues);
  }
  return parsed.data;
}

// Step 2: Add tests for validation
describe('validateCustomerNote', () => {
  it('should validate correct data', () => {
    const result = validateCustomerNote({ content: 'Test note' });
    expect(result.content).toBe('Test note');
  });

  it('should reject empty content', () => {
    expect(() => validateCustomerNote({ content: '' })).toThrow();
  });
});

// Step 3: Run tests
// npm test -- --grep "validateCustomerNote"
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Read before writing | Better understanding | More upfront time |
| Small changes | Easier verification | More commits |
| Test-driven | Confidence in changes | More development time |
| Feature preservation | No regressions | Verification overhead |
| Documentation | Maintainability | More documentation |

## Cross-References

- **AI review process**: See `docs/44-ai-review-process.md`
- **AI team roles**: See `docs/45-ai-team.md`
- **Decision engine**: See `docs/42-decision-engine.md`
- **Feature preservation**: See `docs/28-feature-preservation.md`
- **Code review**: See `docs/30-code-review.md`

## AI Instructions

When working on this project:
1. Always read documentation before starting
2. Always understand the task before writing code
3. Always create an implementation plan
4. Always write tests first (TDD)
5. Always implement in small steps
6. Always run tests after each change
7. Always verify feature parity
8. Always update documentation
9. Never make large changes at once
10. Never skip verification steps
