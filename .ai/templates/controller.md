# Controller Template

## Purpose

Use this template when creating a new controller. Controllers handle HTTP requests, validate input, call services, and format responses.

## When to Use

- Creating API endpoint handlers
- Building REST controllers for resources
- Handling request/response formatting
- Implementing input validation

---

## Complete File Structure

```
controllers/
  note-controller.ts      # Controller implementation
  note-controller.test.ts # Controller tests
```

---

## Step-by-Step Process

### 1. Define the Controller

```typescript
// controllers/note-controller.ts
import { Request, Response, NextFunction } from "express";
import { NoteService } from "../services/note-service";
import {
  CreateNoteSchema,
  UpdateNoteSchema,
  ListNotesQuerySchema,
} from "../schemas/notes";
import { ZodError } from "zod";
import { AppError } from "../middleware/error-handler";
import { logger } from "../logger";

export class NoteController {
  constructor(private noteService: NoteService) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ListNotesQuerySchema.parse(req.query);
      const customerId = req.params.customerId || (req.query.customerId as string);

      if (!customerId) {
        throw new AppError(400, "customerId is required");
      }

      const result = await this.noteService.listNotes(customerId, query);

      res.json({
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
        res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      const note = await this.noteService.getNoteById(id, customerId);

      if (!note) {
        throw new AppError(404, "Note not found");
      }

      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateNoteSchema.parse(req.body);
      const authorId = req.user?.id;

      if (!authorId) {
        throw new AppError(401, "Authentication required");
      }

      const note = await this.noteService.createNote(input, authorId);

      res.status(201).json({ data: note });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = UpdateNoteSchema.parse(req.body);
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      const note = await this.noteService.updateNote(id, input, customerId);

      if (!note) {
        throw new AppError(404, "Note not found");
      }

      res.json({ data: note });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      const deleted = await this.noteService.deleteNote(id, customerId);

      if (!deleted) {
        throw new AppError(404, "Note not found");
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async togglePin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      const note = await this.noteService.togglePin(id, customerId);

      if (!note) {
        throw new AppError(404, "Note not found");
      }

      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }

  async addTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { tag } = req.body;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      if (!tag || typeof tag !== "string") {
        throw new AppError(400, "tag is required");
      }

      const note = await this.noteService.addTag(id, tag, customerId);

      if (!note) {
        throw new AppError(404, "Note not found");
      }

      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }

  async removeTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, tag } = req.params;
      const customerId = req.query.customerId as string;

      if (!customerId) {
        throw new AppError(400, "customerId query param is required");
      }

      const note = await this.noteService.removeTag(id, tag, customerId);

      if (!note) {
        throw new AppError(404, "Note not found");
      }

      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.customerId;

      if (!customerId) {
        throw new AppError(400, "customerId is required");
      }

      const stats = await this.noteService.getStats(customerId);

      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  }
}
```

### 2. Create Controller Tests

```typescript
// controllers/note-controller.test.ts
import { NoteController } from "./note-controller";
import { NoteService } from "../services/note-service";
import { Request, Response, NextFunction } from "express";

jest.mock("../services/note-service");

describe("NoteController", () => {
  let controller: NoteController;
  let mockService: jest.Mocked<NoteService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockService = {
      listNotes: jest.fn(),
      getNoteById: jest.fn(),
      createNote: jest.fn(),
      updateNote: jest.fn(),
      deleteNote: jest.fn(),
      togglePin: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      getStats: jest.fn(),
    } as any;

    controller = new NoteController(mockService);

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: "user-1" },
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("list", () => {
    it("returns paginated notes", async () => {
      mockRequest.params = { customerId: "cust-1" };
      mockRequest.query = { page: "1", limit: "10" };

      const mockResult = {
        data: [{ id: "note-1", content: "Test" }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockService.listNotes.mockResolvedValue(mockResult as any);

      await controller.list(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockResult.data,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it("returns 400 if customerId missing", async () => {
      mockRequest.query = {};

      await controller.list(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe("getById", () => {
    it("returns a note", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };

      const mockNote = { id: "note-1", content: "Test" };
      mockService.getNoteById.mockResolvedValue(mockNote as any);

      await controller.getById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });

    it("returns 404 if note not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.query = { customerId: "cust-1" };

      mockService.getNoteById.mockResolvedValue(null);

      await controller.getById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe("create", () => {
    it("creates a note", async () => {
      mockRequest.body = {
        customerId: "cust-1",
        content: "New note",
        category: "general",
      };

      const mockNote = { id: "note-1", ...mockRequest.body };
      mockService.createNote.mockResolvedValue(mockNote as any);

      await controller.create(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });

    it("returns 400 for invalid input", async () => {
      mockRequest.body = { content: "" };

      await controller.create(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe("update", () => {
    it("updates a note", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };
      mockRequest.body = { content: "Updated" };

      const mockNote = { id: "note-1", content: "Updated" };
      mockService.updateNote.mockResolvedValue(mockNote as any);

      await controller.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });

    it("returns 404 if note not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.query = { customerId: "cust-1" };
      mockRequest.body = { content: "Updated" };

      mockService.updateNote.mockResolvedValue(null);

      await controller.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe("delete", () => {
    it("deletes a note", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };

      mockService.deleteNote.mockResolvedValue(true);

      await controller.delete(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("returns 404 if note not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.query = { customerId: "cust-1" };

      mockService.deleteNote.mockResolvedValue(false);

      await controller.delete(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe("togglePin", () => {
    it("toggles pin status", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };

      const mockNote = { id: "note-1", isPinned: true };
      mockService.togglePin.mockResolvedValue(mockNote as any);

      await controller.togglePin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });
  });

  describe("addTag", () => {
    it("adds a tag to note", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };
      mockRequest.body = { tag: "important" };

      const mockNote = { id: "note-1", tags: ["important"] };
      mockService.addTag.mockResolvedValue(mockNote as any);

      await controller.addTag(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });

    it("returns 400 if tag missing", async () => {
      mockRequest.params = { id: "note-1" };
      mockRequest.query = { customerId: "cust-1" };
      mockRequest.body = {};

      await controller.addTag(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe("removeTag", () => {
    it("removes a tag from note", async () => {
      mockRequest.params = { id: "note-1", tag: "important" };
      mockRequest.query = { customerId: "cust-1" };

      const mockNote = { id: "note-1", tags: [] };
      mockService.removeTag.mockResolvedValue(mockNote as any);

      await controller.removeTag(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockNote });
    });
  });

  describe("getStats", () => {
    it("returns note statistics", async () => {
      mockRequest.params = { customerId: "cust-1" };

      const mockStats = {
        totalCount: 10,
        categoryCounts: { general: 5, support: 3, billing: 2 },
        pinnedCount: 3,
        recentCount: 7,
      };

      mockService.getStats.mockResolvedValue(mockStats);

      await controller.getStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ data: mockStats });
    });
  });
});
```

### 3. Error Handling Middleware

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
): void {
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
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
      statusCode: 400,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: "Internal server error",
    statusCode: 500,
    timestamp: new Date().toISOString(),
  });
}
```

### 4. Request Validation Middleware

```typescript
// middleware/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  };
}
```

### 5. Authentication Middleware

```typescript
// middleware/authenticate.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth";
import { AppError } from "./error-handler";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyToken(token);

    if (!user) {
      throw new AppError(401, "Invalid token");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, "Authentication failed"));
    }
  }
}
```

### 6. Authorization Middleware

```typescript
// middleware/authorize.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "./error-handler";

type Permission = string;

export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some((p) => userPermissions.includes(p));

    if (!hasPermission) {
      return next(new AppError(403, "Insufficient permissions"));
    }

    next();
  };
}
```

### 7. Rate Limiting Middleware

```typescript
// middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many requests",
    statusCode: 429,
  },
});
```

---

## Controller Checklist

### Structure
- [ ] Controller class created
- [ ] Dependencies injected via constructor
- [ ] Methods follow naming convention (list, getById, create, update, delete)
- [ ] Async methods with proper error handling

### Input Handling
- [ ] Input validation with Zod
- [ ] Required fields checked
- [ ] Query parameters validated
- [ ] Request body validated

### Error Handling
- [ ] Try-catch blocks around service calls
- [ ] AppError thrown for expected errors
- [ ] next() called for unexpected errors
- [ ] No error details leaked to client

### Response Format
- [ ] Consistent response structure
- [ ] Proper HTTP status codes
- [ ] Pagination format for lists
- [ ] No extra data in responses

### Security
- [ ] Authentication checked
- [ ] Authorization checked
- [ ] Rate limiting applied
- [ ] Input sanitized

### Testing
- [ ] Unit tests for all methods
- [ ] Mock service dependencies
- [ ] Test validation errors
- [ ] Test not found errors
- [ ] Test authentication errors
- [ ] Test authorization errors

---

## Common Mistakes to Avoid

1. **Business logic in controller** - Keep controllers thin
2. **Missing validation** - Always validate input
3. **Leaking errors** - Never expose internal errors
4. **Inconsistent responses** - Use standard format
5. **No authentication** - Protect all endpoints
6. **No authorization** - Check permissions
7. **Missing rate limiting** - Prevent abuse
8. **Not logging errors** - Log for debugging
9. **Skipping tests** - Write comprehensive tests
10. **Tight coupling** - Use dependency injection

---

## Cross-References

- See `service.md` for business logic layer
- See `repository.md` for data access layer
- See `api.md` for route definitions
- See `new-feature.md` for the full feature creation process
