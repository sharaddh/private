# Database Migration Template

## Purpose

Use this template when creating database migrations. Migrations track schema changes and ensure database consistency across environments.

## When to Use

- Adding new tables or collections
- Modifying existing schema
- Adding indexes
- Creating views or stored procedures
- Data transformations

---

## Complete File Structure

```
migrations/
  20240115_add_notes_table.ts       # Migration file
  20240115_add_notes_table.test.ts  # Migration tests
```

---

## Step-by-Step Process

### 1. Create Migration File

```typescript
// migrations/20240115_add_notes_table.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotesTable1705312000000 implements MigrationInterface {
  name = "AddNotesTable1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the notes table
    await queryRunner.query(`
      CREATE TABLE "notes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" UUID NOT NULL,
        "author_id" UUID NOT NULL,
        "content" VARCHAR(5000) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'general',
        "is_pinned" BOOLEAN NOT NULL DEFAULT false,
        "tags" TEXT[] DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notes_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_notes_author" FOREIGN KEY ("author_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_notes_category" CHECK
          ("category" IN ('general', 'support', 'billing', 'feedback'))
      )
    `);

    // Create indexes
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

    await queryRunner.query(`
      CREATE INDEX "idx_notes_is_pinned" ON "notes"("is_pinned")
      WHERE "is_pinned" = true
    `);

    // GIN index for tags array
    await queryRunner.query(`
      CREATE INDEX "idx_notes_tags" ON "notes" USING GIN("tags")
    `);

    // Composite index for common queries
    await queryRunner.query(`
      CREATE INDEX "idx_notes_customer_category" ON "notes"("customer_id", "category")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notes_customer_pinned" ON "notes"("customer_id", "is_pinned")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_customer_pinned"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_customer_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_tags"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_is_pinned"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_author_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_customer_id"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "notes"`);
  }
}
```

### 2. Schema Migration Patterns

#### Adding a Column

```typescript
export class AddColumn1705312000000 implements MigrationInterface {
  name = "AddColumn1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "priority" VARCHAR(10) NOT NULL DEFAULT 'medium'
    `);

    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "due_date" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "due_date"
    `);

    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "priority"
    `);
  }
}
```

#### Modifying a Column

```typescript
export class ModifyColumn1705312000000 implements MigrationInterface {
  name = "ModifyColumn1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL requires type change via ALTER COLUMN
    await queryRunner.query(`
      ALTER TABLE "notes"
      ALTER COLUMN "content" TYPE VARCHAR(10000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes"
      ALTER COLUMN "content" TYPE VARCHAR(5000)
    `);
  }
}
```

#### Adding a Constraint

```typescript
export class AddConstraint1705312000000 implements MigrationInterface {
  name = "AddConstraint1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD CONSTRAINT "chk_notes_content_length"
      CHECK (LENGTH("content") > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes"
      DROP CONSTRAINT IF EXISTS "chk_notes_content_length"
    `);
  }
}
```

### 3. Data Migration Patterns

#### Populating New Column

```typescript
export class PopulateColumn1705312000000 implements MigrationInterface {
  name = "PopulateColumn1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column first
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "search_vector" tsvector
    `);

    // Populate with data
    await queryRunner.query(`
      UPDATE "notes"
      SET "search_vector" = to_tsvector('english', "content")
    `);

    // Add index after populating
    await queryRunner.query(`
      CREATE INDEX "idx_notes_search"
      ON "notes" USING GIN("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notes_search"`);
    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "search_vector"
    `);
  }
}
```

#### Transforming Data

```typescript
export class TransformData1705312000000 implements MigrationInterface {
  name = "TransformData1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new column
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "tags_new" JSONB DEFAULT '[]'
    `);

    // Transform data from TEXT[] to JSONB
    await queryRunner.query(`
      UPDATE "notes"
      SET "tags_new" = to_jsonb("tags")
    `);

    // Drop old column
    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "tags"
    `);

    // Rename new column
    await queryRunner.query(`
      ALTER TABLE "notes"
      RENAME COLUMN "tags_new" TO "tags"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse transformation
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "tags_old" TEXT[]
    `);

    await queryRunner.query(`
      UPDATE "notes"
      SET "tags_old" = ARRAY(SELECT jsonb_array_elements_text("tags"))
    `);

    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "tags"
    `);

    await queryRunner.query(`
      ALTER TABLE "notes"
      RENAME COLUMN "tags_old" TO "tags"
    `);
  }
}
```

#### Breaking Up Large Table

```typescript
export class BreakUpTable1705312000000 implements MigrationInterface {
  name = "BreakUpTable1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new table
    await queryRunner.query(`
      CREATE TABLE "note_attachments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "note_id" UUID NOT NULL,
        "file_name" VARCHAR(255) NOT NULL,
        "file_url" VARCHAR(500) NOT NULL,
        "file_size" INTEGER NOT NULL,
        "mime_type" VARCHAR(100) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_note_attachments_note"
          FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE
      )
    `);

    // Create index
    await queryRunner.query(`
      CREATE INDEX "idx_note_attachments_note_id"
      ON "note_attachments"("note_id")
    `);

    // Migrate data from JSON column
    await queryRunner.query(`
      INSERT INTO "note_attachments" ("note_id", "file_name", "file_url", "file_size", "mime_type")
      SELECT
        "id",
        (attachment->>'name')::VARCHAR(255),
        (attachment->>'url')::VARCHAR(500),
        (attachment->>'size')::INTEGER,
        (attachment->>'type')::VARCHAR(100)
      FROM "notes",
           jsonb_array_elements("attachments") AS attachment
      WHERE "attachments" IS NOT NULL
        AND jsonb_array_length("attachments") > 0
    `);

    // Drop old column
    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "attachments"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back JSON column
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "attachments" JSONB DEFAULT '[]'
    `);

    // Migrate data back
    await queryRunner.query(`
      UPDATE "notes" n
      SET "attachments" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', na."file_name",
            'url', na."file_url",
            'size', na."file_size",
            'type', na."mime_type"
          )
        )
        FROM "note_attachments" na
        WHERE na."note_id" = n."id"
      )
    `);

    // Drop new table
    await queryRunner.query(`DROP TABLE IF EXISTS "note_attachments"`);
  }
}
```

### 4. Migration Tests

```typescript
// migrations/20240115_add_notes_table.test.ts
import { DataSource } from "typeorm";
import { AddNotesTable1705312000000 } from "./20240115_add_notes_table";

describe("AddNotesTable migration", () => {
  let dataSource: DataSource;
  let migration: AddNotesTable1705312000000;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      host: "localhost",
      port: 5432,
      database: "test_db",
      username: "test",
      password: "test",
      migrations: [AddNotesTable1705312000000],
    });

    await dataSource.initialize();
    migration = new AddNotesTable1705312000000();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it("creates notes table", async () => {
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);

    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'notes'
      )
    `);

    expect(tableExists[0].exists).toBe(true);

    await migration.down(queryRunner);
  });

  it("creates required indexes", async () => {
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);

    const indexes = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'notes'
    `);

    const indexNames = indexes.map((i: any) => i.indexname);

    expect(indexNames).toContain("idx_notes_customer_id");
    expect(indexNames).toContain("idx_notes_author_id");
    expect(indexNames).toContain("idx_notes_category");
    expect(indexNames).toContain("idx_notes_created_at");

    await migration.down(queryRunner);
  });

  it("adds foreign key constraints", async () => {
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);

    const constraints = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'notes'
        AND constraint_type = 'FOREIGN KEY'
    `);

    const constraintNames = constraints.map((c: any) => c.constraint_name);

    expect(constraintNames).toContain("fk_notes_customer");
    expect(constraintNames).toContain("fk_notes_author");

    await migration.down(queryRunner);
  });

  it("reversible migration", async () => {
    const queryRunner = dataSource.createQueryRunner();

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'notes'
      )
    `);

    expect(tableExists[0].exists).toBe(false);
  });
});
```

---

## Migration Best Practices

### Naming Convention

```typescript
// Format: YYYYMMDD_description
// Examples:
// 20240115_add_notes_table
// 20240116_add_notes_indexes
// 20240117_populate_notes_data
```

### Transaction Safety

```typescript
export class SafeMigration1705312000000 implements MigrationInterface {
  name = "SafeMigration1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use transaction for atomic operations
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`CREATE TABLE "notes" (...)`);
      await queryRunner.query(`CREATE INDEX ...`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`DROP INDEX ...`);
      await queryRunner.query(`DROP TABLE "notes"`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
```

### Handling Large Data Migrations

```typescript
export class LargeDataMigration1705312000000 implements MigrationInterface {
  name = "LargeDataMigration1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Process in batches to avoid memory issues
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await queryRunner.query(`
        SELECT id, old_column
        FROM notes
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      for (const row of batch) {
        await queryRunner.query(`
          UPDATE notes
          SET new_column = $1
          WHERE id = $2
        `, [this.transformData(row.old_column), row.id]);
      }

      offset += batchSize;
    }
  }

  private transformData(oldValue: string): string {
    // Transform logic here
    return oldValue.toUpperCase();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse transformation
    await queryRunner.query(`
      UPDATE notes SET new_column = NULL
    `);
  }
}
```

### Zero-Downtime Migrations

```typescript
export class ZeroDowntimeMigration1705312000000 implements MigrationInterface {
  name = "ZeroDowntimeMigration1705312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new column with default
    await queryRunner.query(`
      ALTER TABLE "notes"
      ADD COLUMN "status_new" VARCHAR(20) DEFAULT 'active'
    `);

    // Step 2: Populate in batches (background job)
    // This would typically be done in a separate migration or background job

    // Step 3: Add NOT NULL constraint after population
    await queryRunner.query(`
      ALTER TABLE "notes"
      ALTER COLUMN "status_new" SET NOT NULL
    `);

    // Step 4: Rename columns (in a separate migration after verification)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes" DROP COLUMN "status_new"
    `);
  }
}
```

---

## Migration Checklist

### Before Creating Migration
- [ ] Schema change requirements understood
- [ ] Data transformation needs identified
- [ ] Backward compatibility considered
- [ ] Rollback strategy planned

### Migration Structure
- [ ] Proper naming convention
- [ ] Migration class implements MigrationInterface
- [ ] up() method implemented
- [ ] down() method implemented
- [ ] Transaction handling where needed

### Schema Changes
- [ ] Table created with proper constraints
- [ ] Columns have correct types
- [ ] Default values set appropriately
- [ ] Foreign keys defined
- [ ] Indexes created for performance
- [ ] Check constraints added

### Data Changes
- [ ] Data transformation logic correct
- [ ] Batch processing for large datasets
- [ ] Null handling considered
- [ ] Data integrity maintained

### Testing
- [ ] Migration runs successfully
- [ ] Rollback works correctly
- [ ] Idempotent (can run multiple times)
- [ ] Performance acceptable
- [ ] No data loss

### Documentation
- [ ] Migration purpose documented
- [ ] Schema changes explained
- [ ] Data transformation described
- [ ] Rollback procedure documented

---

## Common Mistakes to Avoid

1. **No rollback plan** - Always implement down() method
2. **Breaking changes** - Consider backward compatibility
3. **Missing indexes** - Add indexes for query performance
4. **Large transactions** - Process large data in batches
5. **No testing** - Test migrations in staging first
6. **Hardcoded values** - Use parameters for values
7. **Ignoring performance** - Profile migration on large datasets
8. **Skipping backups** - Backup before major migrations
9. **Not documenting** - Document schema changes
10. **Rushing to production** - Test thoroughly

---

## Cross-References

- See `repository.md` for how repositories use the schema
- See `service.md` for services that depend on the schema
- See `new-feature.md` for the full feature creation process
- See `bug-fix.md` for fixing migration issues
