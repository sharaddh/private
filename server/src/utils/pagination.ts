import { Query, Document } from "mongoose";
import { istStartOfDay, istEndOfDay } from "./date";

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
const MAX_LIMIT = 10000;
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
      cursorQuery
        .sort({ _id: -1 })
        .limit(pageSize + 1)
        .lean(),
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
    start = istStartOfDay(query.startDate);
  }
  if (query.endDate) {
    end = istEndOfDay(query.endDate);
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

export interface PrismaRange {
  gte?: Date;
  lte?: Date;
}

export function prismaDateRange(
  fieldName: string,
  start?: Date,
  end?: Date
): { [key: string]: PrismaRange } | undefined {
  if (!start && !end) return undefined;
  const range: PrismaRange = {};
  if (start) range.gte = start;
  if (end) range.lte = end;
  return { [fieldName]: range };
}

/**
 * Prisma-native pagination. `findMany`/`count` are the delegate methods (already
 * branch-scoped where applicable). `baseArgs` may carry `where`, `include`,
 * `select`, etc.
 */
export async function paginateFind<T>(
  findMany: (args: any) => Promise<T[]>,
  count: (where: any) => Promise<number>,
  options: PaginationOptions = {},
  baseArgs: any = {}
): Promise<PaginatedResult<T>> {
  const pageSize = Math.min(
    Math.max(parseInt(options.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MIN_LIMIT),
    MAX_LIMIT
  );
  const where = baseArgs.where ?? {};
  const isCursorBased = !!options.cursor;

  if (isCursorBased) {
    const data = await findMany({
      ...baseArgs,
      where: { ...where, id: { lt: options.cursor } },
      orderBy: { id: "desc" },
      take: pageSize + 1,
    });
    const total = await count(where);

    const hasMore = data.length > pageSize;
    const sliced = hasMore ? data.slice(0, pageSize) : data;
    const nextCursor =
      hasMore && sliced.length > 0 ? String((sliced[sliced.length - 1] as any).id) : null;

    return {
      data: sliced,
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
    findMany({
      ...baseArgs,
      where,
      orderBy: baseArgs.orderBy ?? { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    count(where),
  ]);

  return {
    data,
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    hasMore: pageNum * pageSize < total,
    nextCursor: null,
  };
}
