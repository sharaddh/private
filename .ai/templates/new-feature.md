# New Feature Template

## Purpose

Use this template when adding a completely new feature to the codebase. This covers the full lifecycle from planning through implementation and documentation.

## When to Use

- Adding a new domain concept (e.g., Notes, Tags, Categories)
- Building a new user-facing capability
- Introducing new API endpoints that don't fit existing features

---

## Step-by-Step Process

### 1. Planning Phase

Before writing any code:

1. Define the feature requirements clearly
2. Identify all affected layers (API, UI, DB, services)
3. Sketch the data model
4. List all API endpoints needed
5. Identify integration points with existing features

### 2. Database Layer

Start from the bottom up:

1. Design the schema
2. Create the migration
3. Add indexes
4. Create the repository

### 3. Service Layer

1. Define the service interface
2. Implement the service class
3. Register in dependency injection

### 4. Controller Layer

1. Create the controller
2. Wire up route handlers
3. Add validation

### 5. API Layer

1. Create route definitions
2. Add Zod schemas
3. Configure middleware
4. Set up caching

### 6. Frontend Layer

1. Create API hooks
2. Build components
3. Create pages
4. Add navigation

### 7. Testing

1. Unit tests for service
2. Unit tests for repository
3. Integration tests for API
4. Component tests

### 8. Documentation

1. Update API docs
2. Update README if needed
3. Add inline documentation

---

## Checklists

### Backend Checklist

- [ ] Schema designed and reviewed
- [ ] Migration created and tested (up + down)
- [ ] Indexes added for query performance
- [ ] Repository with CRUD + custom queries
- [ ] Service with business logic
- [ ] Controller with input validation
- [ ] Routes with Zod validation
- [ ] Error handling at each layer
- [ ] DI registration
- [ ] Unit tests written
- [ ] Integration tests written

### Frontend Checklist

- [ ] API hooks created
- [ ] Components built with proper states (loading, error, empty)
- [ ] Pages wired up with routing
- [ ] Forms with client-side validation
- [ ] Responsive design
- [ ] Accessibility considerations
- [ ] Component tests written

### Database Checklist

- [ ] Schema follows naming conventions
- [ ] All fields have appropriate types
- [ ] Foreign keys defined
- [ ] Indexes for common queries
- [ ] Migration is reversible
- [ ] Migration tested with existing data
- [ ] No data loss on rollback

### Testing Checklist

- [ ] Unit tests for repository methods
- [ ] Unit tests for service methods
- [ ] Integration tests for API endpoints
- [ ] Edge cases covered
- [ ] Error scenarios tested
- [ ] Tests run in CI

### Documentation Checklist

- [ ] API endpoint documented
- [ ] Request/response examples
- [ ] Error codes documented
- [ ] README updated if needed
- [ ] Inline code comments for complex logic

---

## Complete Example: Adding a "Customer Notes" Feature

### Step 1: Schema (schema/notes.ts)

```typescript
import { z } from "zod";

export const NoteSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  category: z.enum(["general", "support", "billing", "feedback"]),
  isPinned: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteSchema = NoteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = CreateNoteSchema.partial();

export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;
```

### Step 2: Migration (migrations/20240115_add_notes.ts)

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotes1705312000000 implements MigrationInterface {
  name = "AddNotes1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" UUID NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
        "author_id" UUID NOT NULL REFERENCES "users"("id"),
        "content" VARCHAR(5000) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'general',
        "is_pinned" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notes_customer_id" ON "notes"("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notes_author_id" ON "notes"("author_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notes_category" ON "notes"("category")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notes_created_at" ON "notes"("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notes"`);
  }
}
```

### Step 3: Repository (repositories/note-repository.ts)

```typescript
import { Repository, DataSource } from "typeorm";
import { Note } from "../schema/notes";

export interface FindNotesOptions {
  customerId?: string;
  authorId?: string;
  category?: string;
  isPinned?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class NoteRepository {
  private repository: Repository<Note>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Note);
  }

  async create(data: Partial<Note>): Promise<Note> {
    const note = this.repository.create(data);
    return this.repository.save(note);
  }

  async findById(id: string): Promise<Note | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByCustomerId(
    customerId: string,
    options: FindNotesOptions = {}
  ): Promise<PaginatedResult<Note>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder("note");

    qb.where("note.customerId = :customerId", { customerId });

    if (options.category) {
      qb.andWhere("note.category = :category", { category: options.category });
    }

    if (options.isPinned !== undefined) {
      qb.andWhere("note.isPinned = :isPinned", { isPinned: options.isPinned });
    }

    if (options.search) {
      qb.andWhere("note.content ILIKE :search", { search: `%${options.search}%` });
    }

    const sortBy = options.sortBy || "createdAt";
    const sortOrder = options.sortOrder || "DESC";
    qb.orderBy(`note.${sortBy}`, sortOrder);

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, data: Partial<Note>): Promise<Note | null> {
    await this.repository.update(id, { ...data, updatedAt: new Date() } as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async countByCustomer(customerId: string): Promise<number> {
    return this.repository.count({ where: { customerId } });
  }
}
```

### Step 4: Service (services/note-service.ts)

```typescript
import { NoteRepository, FindNotesOptions } from "../repositories/note-repository";
import { CreateNoteInput, UpdateNoteInput } from "../schema/notes";

export class NoteService {
  constructor(private noteRepository: NoteRepository) {}

  async createNote(input: CreateNoteInput, authorId: string) {
    const note = await this.noteRepository.create({
      ...input,
      authorId,
    });
    return note;
  }

  async getNote(id: string, customerId: string) {
    const note = await this.noteRepository.findById(id);

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    if (note.customerId !== customerId) {
      throw new ForbiddenError("Access denied");
    }

    return note;
  }

  async getCustomerNotes(customerId: string, options: FindNotesOptions = {}) {
    return this.noteRepository.findByCustomerId(customerId, options);
  }

  async updateNote(id: string, input: UpdateNoteInput, customerId: string) {
    const existing = await this.noteRepository.findById(id);

    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    if (existing.customerId !== customerId) {
      throw new ForbiddenError("Access denied");
    }

    const updated = await this.noteRepository.update(id, input);
    return updated;
  }

  async deleteNote(id: string, customerId: string) {
    const existing = await this.noteRepository.findById(id);

    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    if (existing.customerId !== customerId) {
      throw new ForbiddenError("Access denied");
    }

    return this.noteRepository.delete(id);
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
```

### Step 5: Controller (controllers/note-controller.ts)

```typescript
import { NoteService } from "../services/note-service";
import { CreateNoteSchema, UpdateNoteSchema } from "../schema/notes";
import { Request, Response } from "express";

export class NoteController {
  constructor(private noteService: NoteService) {}

  async create(req: Request, res: Response) {
    const parsed = CreateNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const note = await this.noteService.createNote(parsed.data, req.user.id);
    return res.status(201).json({ data: note });
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const customerId = req.query.customerId as string;

    if (!customerId) {
      return res.status(400).json({ error: "customerId query param required" });
    }

    const note = await this.noteService.getNote(id, customerId);
    return res.json({ data: note });
  }

  async listByCustomer(req: Request, res: Response) {
    const { customerId } = req.params;
    const { page, limit, category, search, isPinned, sortBy, sortOrder } = req.query;

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      category: category as string,
      search: search as string,
      isPinned: isPinned === "true" ? true : isPinned === "false" ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as "ASC" | "DESC") || "DESC",
    };

    const result = await this.noteService.getCustomerNotes(customerId, options);
    return res.json(result);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const customerId = req.query.customerId as string;

    const parsed = UpdateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const note = await this.noteService.updateNote(id, parsed.data, customerId);
    return res.json({ data: note });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const customerId = req.query.customerId as string;

    await this.noteService.deleteNote(id, customerId);
    return res.status(204).send();
  }
}
```

### Step 6: Routes (routes/notes.ts)

```typescript
import { Router } from "express";
import { NoteController } from "../controllers/note-controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
const controller = new NoteController(/* inject service */);

router.post(
  "/",
  authenticate,
  authorize("notes:write"),
  (req, res) => controller.create(req, res)
);

router.get(
  "/:id",
  authenticate,
  authorize("notes:read"),
  (req, res) => controller.getById(req, res)
);

router.get(
  "/customer/:customerId",
  authenticate,
  authorize("notes:read"),
  (req, res) => controller.listByCustomer(req, res)
);

router.put(
  "/:id",
  authenticate,
  authorize("notes:write"),
  (req, res) => controller.update(req, res)
);

router.delete(
  "/:id",
  authenticate,
  authorize("notes:delete"),
  (req, res) => controller.delete(req, res)
);

export default router;
```

### Step 7: Frontend Hook (hooks/use-notes.ts)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface Note {
  id: string;
  customerId: string;
  authorId: string;
  content: string;
  category: "general" | "support" | "billing" | "feedback";
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotesListResponse {
  data: Note[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useNotes(customerId: string, params?: Record<string, string>) {
  return useQuery<NotesListResponse>({
    queryKey: ["notes", customerId, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams(params);
      const { data } = await api.get(
        `/notes/customer/${customerId}?${searchParams.toString()}`
      );
      return data;
    },
    enabled: !!customerId,
  });
}

export function useNote(id: string) {
  return useQuery<{ data: Note }>({
    queryKey: ["note", id],
    queryFn: async () => {
      const { data } = await api.get(`/notes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { customerId: string; content: string; category: string }) => {
      const { data } = await api.post("/notes", input);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notes", variables.customerId] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; content?: string; category?: string; isPinned?: boolean }) => {
      const { data } = await api.put(`/notes/${id}`, input);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notes", data.data.customerId] });
      queryClient.invalidateQueries({ queryKey: ["note", data.data.id] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId: string }) => {
      await api.delete(`/notes/${id}`);
      return { id, customerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notes", variables.customerId] });
    },
  });
}
```

### Step 8: Frontend Component (components/NoteCard.tsx)

```typescript
import { Note } from "../hooks/use-notes";
import { formatDistanceToNow } from "date-fns";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

const categoryColors = {
  general: "bg-gray-100 text-gray-800",
  support: "bg-blue-100 text-blue-800",
  billing: "bg-green-100 text-green-800",
  feedback: "bg-purple-100 text-purple-800",
};

export function NoteCard({ note, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${note.isPinned ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[note.category]}`}>
              {note.category}
            </span>
            {note.isPinned && (
              <span className="text-xs text-yellow-600">Pinned</span>
            )}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
          <p className="mt-2 text-xs text-gray-500">
            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onTogglePin(note.id, note.isPinned)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
            title={note.isPinned ? "Unpin" : "Pin"}
          >
            {note.isPinned ? "unpin" : "pin"}
          </button>
          <button
            onClick={() => onEdit(note)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            edit
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded p-1 text-red-400 hover:bg-red-50"
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 9: DI Registration (container.ts)

```typescript
import { DataSource } from "typeorm";
import { NoteRepository } from "../repositories/note-repository";
import { NoteService } from "../services/note-service";
import { NoteController } from "../controllers/note-controller";

export function registerNoteModule(dataSource: DataSource) {
  const noteRepository = new NoteRepository(dataSource);
  const noteService = new NoteService(noteRepository);
  const noteController = new NoteController(noteService);

  return { noteRepository, noteService, noteController };
}
```

---

## Common Mistakes to Avoid

1. **Skipping the repository layer** - Always go through the repository for DB access
2. **Missing authorization checks** - Verify ownership at the service layer
3. **No pagination** - Always paginate list endpoints
4. **Forgetting indexes** - Add indexes for foreign keys and filter columns
5. **Hardcoded values** - Extract magic strings to constants
6. **No input validation** - Validate at both API and service layers
7. **Skipping migration rollback testing** - Always test `down()` migration
8. **Missing error handling** - Handle all error cases at each layer
9. **No optimistic updates** - Use React Query's optimistic updates for better UX
10. **Forgetting cache invalidation** - Invalidate related queries on mutations

---

## Cross-References

- See `api.md` for detailed API endpoint creation
- See `component.md` for detailed component creation
- See `service.md` for detailed service creation
- See `repository.md` for detailed repository creation
- See `controller.md` for detailed controller creation
- See `migration.md` for detailed migration creation
