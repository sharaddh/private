import { Query, Document } from "mongoose";

export interface PaginationOptions {
  page?: string;
  limit?: string;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_LIMIT = 1;

export { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT };

export async function paginateQuery<T extends Document>(
  baseQuery: Query<T[], T>,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const pageSize = Math.min(
    Math.max(parseInt(options.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const isCursorBased = !!options.cursor;

  if (isCursorBased) {
    const cursorQuery = baseQuery.clone();
    cursorQuery.where("_id").lt(options.cursor as unknown as number);

    const [data, total] = await Promise.all([
      cursorQuery.sort({ _id: -1 }).limit(pageSize + 1).lean(),
      baseQuery.model.countDocuments(baseQuery.getFilter()),
    ]);

    const hasMore = data.length > pageSize;
    const sliced = hasMore ? data.slice(0, pageSize) : data;
    const nextCursor = hasMore && sliced.length > 0 ? String(sliced[sliced.length - 1]._id) : null;

    return {
      data: sliced as unknown as T[],
      total,
      page: 1,
      pages: Math.ceil(total / pageSize),
      hasMore,
      nextCursor,
    };
  }

  const pageNum = Math.max(parseInt(options.page || "1", 10) || 1, 1);
  const skip = (pageNum - 1) * pageSize;

  const [data, total] = await Promise.all([
    baseQuery.sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    baseQuery.model.countDocuments(baseQuery.getFilter()),
  ]);

  return {
    data: data as unknown as T[],
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    hasMore: pageNum * pageSize < total,
    nextCursor: null,
  };
}

export function parseDateRange(query: { startDate?: string; endDate?: string }): {
  start?: Date;
  end?: Date;
} {
  let start: Date | undefined;
  let end: Date | undefined;

  if (query.startDate) {
    start = new Date(query.startDate);
    start.setHours(0, 0, 0, 0);
  }
  if (query.endDate) {
    end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export function buildDateFilter(
  fieldName: string,
  start?: Date,
  end?: Date
): Record<string, unknown> | undefined {
  if (!start && !end) return undefined;
  const filter: Record<string, Date> = {};
  if (start) filter.$gte = start;
  if (end) filter.$lte = end;
  return { [fieldName]: filter };
}
