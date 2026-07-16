# React Component Template

## Purpose

Use this template when creating a new React component. This covers component structure, props, state management, event handlers, loading/error/empty states, and styling.

## When to Use

- Building a new UI component
- Creating a card, list, form, or modal component
- Building a page section or layout component
- Creating a reusable component library piece

---

## Complete File Structure

```
components/
  NoteCard/
    NoteCard.tsx          # Main component
    NoteCard.test.tsx     # Component tests
    NoteCard.stories.tsx  # Storybook stories (if applicable)
    index.ts              # Export file
    types.ts              # Props interface (if complex)
```

---

## Step-by-Step Process

### 1. Define Props Interface

```typescript
// components/NoteCard/types.ts
import { Note } from "../../hooks/use-notes";

export interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onAddTag?: (id: string, tag: string) => void;
  onRemoveTag?: (id: string, tag: string) => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  variant?: "default" | "compact" | "detailed";
  className?: string;
}
```

### 2. Create the Component

```typescript
// components/NoteCard/NoteCard.tsx
import { useState } from "react";
import { NoteCardProps } from "./types";
import { formatDistanceToNow } from "date-fns";

const categoryConfig = {
  general: {
    label: "General",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
  },
  support: {
    label: "Support",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
  },
  billing: {
    label: "Billing",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-300",
  },
  feedback: {
    label: "Feedback",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    borderColor: "border-purple-300",
  },
} as const;

export function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onAddTag,
  onRemoveTag,
  isSelectable = false,
  isSelected = false,
  onSelect,
  variant = "default",
  className = "",
}: NoteCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const category = categoryConfig[note.category];
  const timeAgo = formatDistanceToNow(new Date(note.createdAt), {
    addSuffix: true,
  });

  const handleDelete = () => {
    if (isConfirmingDelete) {
      onDelete(note.id);
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 3000);
    }
  };

  const handleClick = () => {
    if (isSelectable && onSelect) {
      onSelect(note.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          isSelected
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 hover:border-gray-300"
        } ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={isSelectable ? "button" : undefined}
        tabIndex={isSelectable ? 0 : undefined}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect?.(note.id)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <div className="flex-1 truncate text-sm text-gray-700">
          {note.content}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${category.bgColor} ${category.textColor}`}>
          {category.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        note.isPinned
          ? "border-yellow-300 bg-yellow-50 shadow-sm"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
      } ${isSelected ? "ring-2 ring-blue-500" : ""} ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isSelectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect?.(note.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${category.bgColor} ${category.textColor}`}
            >
              {category.label}
            </span>
            {note.isPinned && (
              <span className="text-xs font-medium text-yellow-600">Pinned</span>
            )}
          </div>

          {/* Action buttons */}
          <div
            className={`flex gap-1 transition-opacity ${
              showActions ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id, note.isPinned);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={note.isPinned ? "Unpin note" : "Pin note"}
            >
              {note.isPinned ? "unpin" : "pin"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Edit note"
            >
              edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className={`rounded p-1 ${
                isConfirmingDelete
                  ? "bg-red-100 text-red-600"
                  : "text-gray-400 hover:bg-red-50 hover:text-red-600"
              }`}
              title={isConfirmingDelete ? "Click again to confirm" : "Delete note"}
            >
              {isConfirmingDelete ? "confirm?" : "delete"}
            </button>
          </div>
        </div>

        {/* Content */}
        <p className="whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
                {onRemoveTag && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(note.id, tag);
                    }}
                    className="ml-0.5 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{timeAgo}</span>
          {variant === "detailed" && (
            <span className="text-gray-400">
              by {note.authorName || "Unknown"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3. Create Index Export

```typescript
// components/NoteCard/index.ts
export { NoteCard } from "./NoteCard";
export type { NoteCardProps } from "./types";
```

### 4. Create Tests

```typescript
// components/NoteCard/NoteCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteCard } from "./NoteCard";
import { Note } from "../../hooks/use-notes";

const mockNote: Note = {
  id: "1",
  customerId: "cust-1",
  authorId: "user-1",
  content: "Test note content",
  category: "general",
  isPinned: false,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:30:00Z",
};

const defaultProps = {
  note: mockNote,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onTogglePin: jest.fn(),
};

describe("NoteCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders note content", () => {
    render(<NoteCard {...defaultProps} />);
    expect(screen.getByText("Test note content")).toBeInTheDocument();
  });

  it("renders category badge", () => {
    render(<NoteCard {...defaultProps} />);
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("calls onEdit when edit button clicked", () => {
    render(<NoteCard {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Edit note"));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockNote);
  });

  it("calls onDelete when delete confirmed", () => {
    render(<NoteCard {...defaultProps} />);
    const deleteButton = screen.getByTitle("Delete note");
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    expect(defaultProps.onDelete).toHaveBeenCalledWith("1");
  });

  it("calls onTogglePin when pin button clicked", () => {
    render(<NoteCard {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Pin note"));
    expect(defaultProps.onTogglePin).toHaveBeenCalledWith("1", false);
  });

  it("renders pinned state correctly", () => {
    const pinnedNote = { ...mockNote, isPinned: true };
    render(<NoteCard {...defaultProps} note={pinnedNote} />);
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("unpin")).toBeInTheDocument();
  });

  it("renders in compact variant", () => {
    render(<NoteCard {...defaultProps} variant="compact" />);
    expect(screen.getByText("Test note content")).toBeInTheDocument();
  });

  it("handles selection", () => {
    const onSelect = jest.fn();
    render(
      <NoteCard
        {...defaultProps}
        isSelectable={true}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("renders tags", () => {
    const noteWithTags = {
      ...mockNote,
      tags: ["important", "follow-up"],
    };
    render(<NoteCard {...defaultProps} note={noteWithTags} />);
    expect(screen.getByText("important")).toBeInTheDocument();
    expect(screen.getByText("follow-up")).toBeInTheDocument();
  });

  it("calls onRemoveTag when tag removed", () => {
    const onRemoveTag = jest.fn();
    const noteWithTags = {
      ...mockNote,
      tags: ["important"],
    };
    render(
      <NoteCard
        {...defaultProps}
        note={noteWithTags}
        onRemoveTag={onRemoveTag}
      />
    );
    fireEvent.click(screen.getByText("×"));
    expect(onRemoveTag).toHaveBeenCalledWith("1", "important");
  });
});
```

---

## Loading State Component

```typescript
// components/NoteCard/NoteCardSkeleton.tsx
export function NoteCardSkeleton({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
        <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
        <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mt-3 h-3 w-24 animate-pulse rounded bg-gray-200" />
    </div>
  );
}
```

## Empty State Component

```typescript
// components/NoteCard/NoteCardEmpty.tsx
interface NoteCardEmptyProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function NoteCardEmpty({
  title = "No notes yet",
  description = "Create your first note to get started.",
  action,
}: NoteCardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <div className="mb-4 text-4xl text-gray-400">notes</div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-gray-500">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

## Error State Component

```typescript
// components/NoteCard/NoteCardError.tsx
interface NoteCardErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function NoteCardError({
  title = "Something went wrong",
  message = "Failed to load notes. Please try again.",
  onRetry,
}: NoteCardErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-12 text-center">
      <div className="mb-4 text-4xl text-red-400">error</div>
      <h3 className="mb-2 text-lg font-medium text-red-900">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
```

---

## Complete Page Example

```typescript
// pages/CustomerNotes.tsx
import { useState } from "react";
import { useNotes, useCreateNote, useDeleteNote, useUpdateNote } from "../hooks/use-notes";
import { NoteCard, NoteCardSkeleton, NoteCardEmpty, NoteCardError } from "../components/NoteCard";
import { Note } from "../hooks/use-notes";

interface CustomerNotesProps {
  customerId: string;
}

export function CustomerNotes({ customerId }: CustomerNotesProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();

  const { data, isLoading, error, refetch } = useNotes(customerId, {
    page: page.toString(),
    limit: "10",
    search,
    category,
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const handleCreate = () => {
    createNote.mutate({
      customerId,
      content: "New note",
      category: "general",
    });
  };

  const handleEdit = (note: Note) => {
    // Open edit modal
    console.log("Edit note:", note);
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate({ id, customerId });
  };

  const handleTogglePin = (id: string, isPinned: boolean) => {
    updateNote.mutate({ id, isPinned: !isPinned });
  };

  if (error) {
    return <NoteCardError onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Notes ({data?.total || 0})
        </h2>
        <button
          onClick={handleCreate}
          disabled={createNote.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createNote.isPending ? "Creating..." : "Add Note"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={category || ""}
          onChange={(e) => {
            setCategory(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          <option value="general">General</option>
          <option value="support">Support</option>
          <option value="billing">Billing</option>
          <option value="feedback">Feedback</option>
        </select>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <NoteCardEmpty
          action={{ label: "Create Note", onClick: handleCreate }}
        />
      ) : (
        <div className="space-y-3">
          {data?.data.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Component Checklist

### Structure
- [ ] Props interface defined
- [ ] Component has single responsibility
- [ ] Component is properly exported
- [ ] Types are exported for consumers

### States
- [ ] Loading state handled
- [ ] Error state handled
- [ ] Empty state handled
- [ ] Success state handled

### Interaction
- [ ] Click handlers work correctly
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] Disabled states handled

### Styling
- [ ] Responsive design
- [ ] Consistent with design system
- [ ] Hover/focus states
- [ ] Loading indicators

### Accessibility
- [ ] Proper ARIA labels
- [ ] Keyboard navigable
- [ ] Screen reader friendly
- [ ] Color contrast sufficient

### Testing
- [ ] Unit tests written
- [ ] Edge cases covered
- [ ] User interactions tested
- [ ] Error scenarios tested

---

## Common Mistakes to Avoid

1. **Too many props** - Keep props minimal and focused
2. **Missing key prop** - Always provide unique keys in lists
3. **Inline styles** - Use Tailwind classes instead
4. **No loading states** - Always show loading indicators
5. **No error handling** - Always handle error states
6. **Missing accessibility** - Add ARIA labels and keyboard support
7. **Optimizing too early** - Get it working first, then optimize
8. **Not testing** - Write tests for all components
9. **Tight coupling** - Keep components independent
10. **Ignoring mobile** - Ensure responsive design

---

## Cross-References

- See `new-feature.md` for creating a new feature with components
- See `api.md` for the API endpoints these components consume
- See `service.md` for the service layer these components interact with
