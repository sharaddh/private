# API Endpoint Template

## Purpose

Use this template when creating a new API endpoint. This covers route definition, validation, handling, error management, and caching.

## When to Use

- Adding a new REST API endpoint
- Creating CRUD operations for a resource
- Building a search/filter endpoint
- Adding a custom action endpoint

---

## Complete File Structure

```
api/
  routes/
    notes.ts           # Route definitions
  schemas/
    notes.ts           # Zod validation schemas
  controllers/
    note-controller.ts # Request handlers
  services/
    note-service.ts    # Business logic
  repositories/
    note-repository.ts # Database queries
  middleware/
    authenticate.ts    # Auth middleware
    authorize.ts       # Permission middleware
    validate.ts        # Validation middleware
  types/
    notes.ts           # TypeScript types
```

---

## Step-by-Step Process

### 1. Define the Route

Create route file with proper structure:

```typescript
// routes/notes.ts
import { Router } from "express";
import { NoteController } from "../controllers/note-controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
const controller = new NoteController();

// Public routes (if any)
// router.get("/public/notes", (req, res) => controller.listPublic(req, res));

// Protected routes
router.get(
  "/",
  authenticate,
  authorize("notes:read"),
  (req, res) => controller.list(req, res)
);

router.get(
  "/:id",
  authenticate,
  authorize("notes:read"),
  (req, res) => controller.getById(req, res)
);

router.post(
  "/",
  authenticate,
  authorize("notes:write"),
  (req, res) => controller.create(req, res)
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

### 2. Create Validation Schema

```typescript
// schemas/notes.ts
import { z } from "zod";

export const NoteCategorySchema = z.enum([
  "general",
  "support",
  "billing",
  "feedback",
]);

export const CreateNoteSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content must be less than 5000 characters"),
  category: NoteCategorySchema.default("general"),
  isPinned: z.boolean().default(false),
  tags: z.array(z.string()).max(10, "Maximum 10 tags allowed").optional(),
});

export const UpdateNoteSchema = CreateNoteSchema.partial().omit({
  customerId: true,
});

export const ListNotesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  category: NoteCategorySchema.optional(),
  search: z.string().max(200).optional(),
  isPinned: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  sortBy: z.enum(["createdAt", "updatedAt", "content"]).default("createdAt"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;
```

### 3. Create Controller

```typescript
// controllers/note-controller.ts
import { Request, Response } from "express";
import { NoteService } from "../services/note-service";
import {
  CreateNoteSchema,
  UpdateNoteSchema,
  ListNotesQuerySchema,
} from "../schemas/notes";
import { ZodError } from "zod";

export class NoteController {
  private noteService: NoteService;

  constructor() {
    this.noteService = new NoteService();
  }

  async list(req: Request, res: Response) {
    try {
      const query = ListNotesQuerySchema.parse(req.query);
      const customerId = req.params.customerId || (req.query.customerId as string);

      if (!customerId) {
        return res.status(400).json({
          error: "customerId is required",
        });
      }

      const result = await this.noteService.listNotes(customerId, query);

      return res.json({
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
      }
      throw error;
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        return res.status(400).json({
          error: "customerId query param is required",
        });
      }

      const note = await this.noteService.getNoteById(id, customerId);

      if (!note) {
        return res.status(404).json({
          error: "Note not found",
        });
      }

      return res.json({ data: note });
    } catch (error) {
      throw error;
    }
  }

  async create(req: Request, res: Response) {
    try {
      const input = CreateNoteSchema.parse(req.body);
      const authorId = req.user?.id;

      if (!authorId) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const note = await this.noteService.createNote(input, authorId);

      return res.status(201).json({ data: note });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
      }
      throw error;
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const input = UpdateNoteSchema.parse(req.body);
      const customerId = req.query.customerId as string;

      if (!customerId) {
        return res.status(400).json({
          error: "customerId query param is required",
        });
      }

      const note = await this.noteService.updateNote(id, input, customerId);

      if (!note) {
        return res.status(404).json({
          error: "Note not found",
        });
      }

      return res.json({ data: note });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
      }
      throw error;
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        return res.status(400).json({
          error: "customerId query param is required",
        });
      }

      const deleted = await this.noteService.deleteNote(id, customerId);

      if (!deleted) {
        return res.status(404).json({
          error: "Note not found",
        });
      }

      return res.status(204).send();
    } catch (error) {
      throw error;
    }
  }
}
```

### 4. Response Formatting

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
  statusCode: number;
  timestamp: string;
}

// Error responses
export const ErrorResponses = {
  badRequest: (message: string): ApiError => ({
    error: message,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  }),

  unauthorized: (): ApiError => ({
    error: "Authentication required",
    statusCode: 401,
    timestamp: new Date().toISOString(),
  }),

  forbidden: (): ApiError => ({
    error: "Insufficient permissions",
    statusCode: 403,
    timestamp: new Date().toISOString(),
  }),

  notFound: (resource: string): ApiError => ({
    error: `${resource} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  }),

  conflict: (message: string): ApiError => ({
    error: message,
    statusCode: 409,
    timestamp: new Date().toISOString(),
  }),

  internal: (): ApiError => ({
    error: "Internal server error",
    statusCode: 500,
    timestamp: new Date().toISOString(),
  }),
};
```

### 5. Error Handling Middleware

```typescript
// middleware/error-handler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
      statusCode: 400,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle unknown errors
  return res.status(500).json({
    error: "Internal server error",
    statusCode: 500,
    timestamp: new Date().toISOString(),
  });
}
```

### 6. Cache Configuration

```typescript
// middleware/cache.ts
import { Request, Response, NextFunction } from "express";
import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 60, // 60 seconds default
  checkperiod: 120,
  useClones: false,
});

export function cacheMiddleware(duration: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = `${req.user?.id || "anon"}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cache.set(key, body, duration);
      return originalJson(body);
    };

    next();
  };
}

export function invalidateCache(pattern: string) {
  const keys = cache.keys();
  const matchingKeys = keys.filter((key) => key.includes(pattern));
  cache.del(matchingKeys);
}

export function clearCache() {
  cache.flushAll();
}
```

### 7. Complete Route with Cache

```typescript
// routes/notes.ts (with cache)
import { Router } from "express";
import { NoteController } from "../controllers/note-controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { cacheMiddleware } from "../middleware/cache";

const router = Router();
const controller = new NoteController();

router.get(
  "/",
  authenticate,
  authorize("notes:read"),
  cacheMiddleware(30), // Cache for 30 seconds
  (req, res) => controller.list(req, res)
);

router.get(
  "/:id",
  authenticate,
  authorize("notes:read"),
  cacheMiddleware(60), // Cache for 60 seconds
  (req, res) => controller.getById(req, res)
);

router.post(
  "/",
  authenticate,
  authorize("notes:write"),
  (req, res) => controller.create(req, res)
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

---

## API Contract Documentation

```markdown
## Notes API

### List Notes
**GET /api/notes?customerId=:customerId**

Query Parameters:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `category` (string, optional): Filter by category
- `search` (string, optional): Search in content
- `isPinned` (boolean, optional): Filter by pinned status
- `sortBy` (string, optional): Sort field (default: createdAt)
- `sortOrder` (string, optional): ASC or DESC (default: DESC)

Response 200:
```json
{
  "data": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "authorId": "uuid",
      "content": "Note content",
      "category": "general",
      "isPinned": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Get Note by ID
**GET /api/notes/:id?customerId=:customerId**

Response 200:
```json
{
  "data": {
    "id": "uuid",
    "customerId": "uuid",
    "authorId": "uuid",
    "content": "Note content",
    "category": "general",
    "isPinned": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

Response 404:
```json
{
  "error": "Note not found"
}
```

### Create Note
**POST /api/notes**

Request Body:
```json
{
  "customerId": "uuid",
  "content": "Note content",
  "category": "general",
  "isPinned": false
}
```

Response 201:
```json
{
  "data": {
    "id": "uuid",
    "customerId": "uuid",
    "authorId": "uuid",
    "content": "Note content",
    "category": "general",
    "isPinned": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Update Note
**PUT /api/notes/:id?customerId=:customerId**

Request Body:
```json
{
  "content": "Updated content",
  "category": "support"
}
```

Response 200:
```json
{
  "data": {
    "id": "uuid",
    "customerId": "uuid",
    "authorId": "uuid",
    "content": "Updated content",
    "category": "support",
    "isPinned": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

### Delete Note
**DELETE /api/notes/:id?customerId=:customerId**

Response 204: No Content
```

---

## API Checklist

### Before Implementation
- [ ] Endpoint URL and method defined
- [ ] Request/response schema documented
- [ ] Authentication requirements specified
- [ ] Permission requirements specified
- [ ] Caching strategy defined
- [ ] Error scenarios identified

### Implementation
- [ ] Route file created
- [ ] Zod validation schema created
- [ ] Controller method implemented
- [ ] Service method implemented
- [ ] Repository method implemented
- [ ] Error handling added
- [ ] Caching configured
- [ ] Logging added

### Testing
- [ ] Unit tests for service
- [ ] Unit tests for repository
- [ ] Integration tests for endpoint
- [ ] Validation error tests
- [ ] Authentication error tests
- [ ] Authorization error tests
- [ ] Not found error tests
- [ ] Edge case tests

### Documentation
- [ ] API contract documented
- [ ] Request/response examples
- [ ] Error codes documented
- [ ] Rate limiting documented (if applicable)
- [ ] Cache behavior documented

---

## Common Mistakes to Avoid

1. **Missing input validation** - Always validate with Zod
2. **No authentication** - Protect all non-public endpoints
3. **No authorization** - Check permissions, not just auth
4. **Leaking internal errors** - Return generic messages to clients
5. **No pagination** - Always paginate list endpoints
6. **Forgetting cache headers** - Set appropriate cache headers
7. **Not logging errors** - Log all errors for debugging
8. **Inconsistent response format** - Use standard response format
9. **Missing CORS headers** - Configure CORS properly
10. **No rate limiting** - Protect against abuse

---

## Cross-References

- See `new-feature.md` for the full feature creation process
- See `controller.md` for detailed controller creation
- See `service.md` for detailed service creation
- See `repository.md` for detailed repository creation
