# Repository Template

## Purpose

Use this template when creating a new repository class. Repositories handle all database operations and provide a clean API for data access.

## When to Use

- Creating CRUD operations for a new entity
- Building query methods for a resource
- Implementing search and pagination
- Encapsulating database logic

---

## Complete File Structure

```
repositories/
  note-repository.ts      # Repository implementation
  note-repository.test.ts # Repository tests
```

---

## Step-by-Step Process

### 1. Define the Entity

```typescript
// entities/note.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Customer } from "./customer";
import { User } from "./user";

@Entity("notes")
export class Note {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  @Index()
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: "customer_id" })
  customer: Customer;

  @Column("uuid")
  @Index()
  authorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "author_id" })
  author: User;

  @Column("varchar", { length: 5000 })
  content: string;

  @Column("varchar", { length: 20, default: "general" })
  @Index()
  category: string;

  @Column("boolean", { default: false })
  isPinned: boolean;

  @Column("simple-array", { nullable: true })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. Create Query Options Interface

```typescript
// repositories/note-repository.ts
export interface FindNotesOptions {
  customerId?: string;
  authorId?: string;
  category?: string;
  isPinned?: boolean;
  search?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
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

export interface NoteStats {
  totalCount: number;
  categoryCounts: Record<string, number>;
  pinnedCount: number;
  recentCount: number;
}
```

### 3. Implement the Repository

```typescript
// repositories/note-repository.ts
import { Repository, DataSource, SelectQueryBuilder } from "typeorm";
import { Note } from "../entities/note";
import { FindNotesOptions, PaginatedResult, NoteStats } from "./types";

export class NoteRepository {
  private repository: Repository<Note>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Note);
  }

  async create(data: Partial<Note>): Promise<Note> {
    const note = this.repository.create(data);
    return this.repository.save(note);
  }

  async createBulk(data: Partial<Note>[]): Promise<Note[]> {
    const notes = this.repository.create(data);
    return this.repository.save(notes);
  }

  async findById(id: string, relations: string[] = []): Promise<Note | null> {
    return this.repository.findOne({
      where: { id },
      relations,
    });
  }

  async findByIds(ids: string[]): Promise<Note[]> {
    return this.repository.findByIds(ids);
  }

  async findByCustomerId(
    customerId: string,
    options: FindNotesOptions = {}
  ): Promise<PaginatedResult<Note>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.createQueryBuilder();

    qb.where("note.customerId = :customerId", { customerId });

    this.applyFilters(qb, options);

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

  async findByAuthorId(
    authorId: string,
    options: FindNotesOptions = {}
  ): Promise<PaginatedResult<Note>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.createQueryBuilder();

    qb.where("note.authorId = :authorId", { authorId });

    this.applyFilters(qb, options);

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

  async search(
    query: string,
    customerId: string,
    options: FindNotesOptions = {}
  ): Promise<PaginatedResult<Note>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.createQueryBuilder();

    qb.where("note.customerId = :customerId", { customerId });
    qb.andWhere("note.content ILIKE :query", { query: `%${query}%` });

    this.applyFilters(qb, options);

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

  async findByTag(
    tag: string,
    customerId: string,
    options: FindNotesOptions = {}
  ): Promise<PaginatedResult<Note>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.createQueryBuilder();

    qb.where("note.customerId = :customerId", { customerId });
    qb.andWhere(":tag = ANY(note.tags)", { tag });

    this.applyFilters(qb, options);

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

  async findPinned(customerId: string): Promise<Note[]> {
    return this.repository.find({
      where: {
        customerId,
        isPinned: true,
      },
      order: { createdAt: "DESC" },
    });
  }

  async findRecent(customerId: string, days: number = 7): Promise<Note[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.repository
      .createQueryBuilder("note")
      .where("note.customerId = :customerId", { customerId })
      .andWhere("note.createdAt >= :cutoff", { cutoff })
      .orderBy("note.createdAt", "DESC")
      .getMany();
  }

  async update(id: string, data: Partial<Note>): Promise<Note | null> {
    await this.repository.update(id, {
      ...data,
      updatedAt: new Date(),
    } as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteBulk(ids: string[]): Promise<number> {
    const result = await this.repository.delete(ids);
    return result.affected ?? 0;
  }

  async count(customerId?: string): Promise<number> {
    if (customerId) {
      return this.repository.count({ where: { customerId } });
    }
    return this.repository.count();
  }

  async countByCategory(customerId: string): Promise<Record<string, number>> {
    const result = await this.repository
      .createQueryBuilder("note")
      .select("note.category", "category")
      .addSelect("COUNT(*)", "count")
      .where("note.customerId = :customerId", { customerId })
      .groupBy("note.category")
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.category] = parseInt(row.count, 10);
    }
    return counts;
  }

  async getStats(customerId: string): Promise<NoteStats> {
    const [totalCount, categoryCounts, pinnedCount, recentCount] =
      await Promise.all([
        this.count(customerId),
        this.countByCategory(customerId),
        this.repository.count({
          where: { customerId, isPinned: true },
        }),
        this.repository
          .createQueryBuilder("note")
          .where("note.customerId = :customerId", { customerId })
          .andWhere("note.createdAt >= :cutoff", {
            cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
          .getCount(),
      ]);

    return {
      totalCount,
      categoryCounts,
      pinnedCount,
      recentCount,
    };
  }

  async exists(id: string): Promise<boolean> {
    return this.repository.exist({ where: { id } });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const qb = this.repository
      .createQueryBuilder("note")
      .where("note.email = :email", { email });

    if (excludeId) {
      qb.andWhere("note.id != :excludeId", { excludeId });
    }

    return qb.getExists();
  }

  private createQueryBuilder(): SelectQueryBuilder<Note> {
    return this.repository.createQueryBuilder("note");
  }

  private applyFilters(
    qb: SelectQueryBuilder<Note>,
    options: FindNotesOptions
  ): void {
    if (options.authorId) {
      qb.andWhere("note.authorId = :authorId", { authorId: options.authorId });
    }

    if (options.category) {
      qb.andWhere("note.category = :category", { category: options.category });
    }

    if (options.isPinned !== undefined) {
      qb.andWhere("note.isPinned = :isPinned", { isPinned: options.isPinned });
    }

    if (options.search) {
      qb.andWhere("note.content ILIKE :search", {
        search: `%${options.search}%`,
      });
    }

    if (options.tags && options.tags.length > 0) {
      qb.andWhere("note.tags && :tags", { tags: options.tags });
    }

    if (options.createdAfter) {
      qb.andWhere("note.createdAt >= :createdAfter", {
        createdAfter: options.createdAfter,
      });
    }

    if (options.createdBefore) {
      qb.andWhere("note.createdAt <= :createdBefore", {
        createdBefore: options.createdBefore,
      });
    }
  }
}
```

### 4. Create Repository Tests

```typescript
// repositories/note-repository.test.ts
import { DataSource, Repository } from "typeorm";
import { NoteRepository } from "./note-repository";
import { Note } from "../entities/note";

jest.mock("typeorm");

describe("NoteRepository", () => {
  let repository: NoteRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockRepository: jest.Mocked<Repository<Note>>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findByIds: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    repository = new NoteRepository(mockDataSource);
  });

  describe("create", () => {
    it("creates a new note", async () => {
      const input = {
        customerId: "cust-1",
        authorId: "user-1",
        content: "Test note",
      };

      const mockNote = { id: "note-1", ...input };
      mockRepository.create.mockReturnValue(mockNote as any);
      mockRepository.save.mockResolvedValue(mockNote as any);

      const result = await repository.create(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(mockRepository.save).toHaveBeenCalledWith(mockNote);
      expect(result).toEqual(mockNote);
    });
  });

  describe("findById", () => {
    it("finds a note by id", async () => {
      const mockNote = { id: "note-1", content: "Test" };
      mockRepository.findOne.mockResolvedValue(mockNote as any);

      const result = await repository.findById("note-1");

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "note-1" },
        relations: [],
      });
      expect(result).toEqual(mockNote);
    });

    it("returns null for non-existent note", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByCustomerId", () => {
    it("returns paginated results", async () => {
      const mockNotes = [
        { id: "note-1", content: "Test 1" },
        { id: "note-2", content: "Test 2" },
      ];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockNotes, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await repository.findByCustomerId("cust-1", {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(mockNotes);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("search", () => {
    it("searches notes by content", async () => {
      const mockNotes = [{ id: "note-1", content: "Test note" }];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockNotes, 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await repository.search("test", "cust-1");

      expect(result.data).toEqual(mockNotes);
      expect(result.total).toBe(1);
    });
  });

  describe("update", () => {
    it("updates a note", async () => {
      const mockNote = { id: "note-1", content: "Updated" };
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(mockNote as any);

      const result = await repository.update("note-1", {
        content: "Updated",
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        "note-1",
        expect.objectContaining({ content: "Updated" })
      );
      expect(result).toEqual(mockNote);
    });
  });

  describe("delete", () => {
    it("deletes a note", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await repository.delete("note-1");

      expect(result).toBe(true);
    });

    it("returns false when note not found", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await repository.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("count", () => {
    it("counts all notes", async () => {
      mockRepository.count.mockResolvedValue(10);

      const result = await repository.count();

      expect(result).toBe(10);
    });

    it("counts notes for a customer", async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await repository.count("cust-1");

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { customerId: "cust-1" },
      });
      expect(result).toBe(5);
    });
  });
});
```

---

## Repository Checklist

### Structure
- [ ] Entity defined with proper decorators
- [ ] Repository class created
- [ ] Interface for options defined
- [ ] Paginated result type defined

### CRUD Operations
- [ ] create method
- [ ] createBulk method (for batch operations)
- [ ] findById method
- [ ] findByIds method
- [ ] update method
- [ ] delete method
- [ ] deleteBulk method
- [ ] exists method

### Query Methods
- [ ] findByCustomerId
- [ ] findByAuthorId
- [ ] search
- [ ] findByTag
- [ ] findPinned
- [ ] findRecent

### Statistics
- [ ] count method
- [ ] countByCategory method
- [ ] getStats method

### Indexes
- [ ] Primary key index
- [ ] Foreign key indexes
- [ ] Commonly queried fields indexed
- [ ] Composite indexes for common queries

### Testing
- [ ] Unit tests for all methods
- [ ] Mock database connections
- [ ] Test pagination
- [ ] Test edge cases
- [ ] Test error scenarios

---

## Common Mistakes to Avoid

1. **Business logic in repository** - Keep repositories focused on data access
2. **Missing indexes** - Add indexes for all queried columns
3. **No pagination** - Always paginate list queries
4. **N+1 queries** - Use joins instead of separate queries
5. **Missing transactions** - Use transactions for multi-step operations
6. **Hardcoded queries** - Build queries dynamically based on options
7. **No error handling** - Handle database errors gracefully
8. **Skipping tests** - Write comprehensive tests
9. **Ignoring performance** - Profile queries with large datasets
10. **Leaking SQL errors** - Convert to application errors

---

## Cross-References

- See `service.md` for services that use repositories
- See `controller.md` for controllers that use services
- See `migration.md` for creating database migrations
- See `new-feature.md` for the full feature creation process
