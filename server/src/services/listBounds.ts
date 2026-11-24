import { MAX_LIMIT, MIN_LIMIT } from "../utils/pagination";

export interface ListPageParams {
  limit?: unknown;
  page?: unknown;
  skip?: unknown;
}

export interface BoundedListArgs {
  take: number;
  skip: number;
}

const DEFAULT_TAKE = 100;
const MAX_SKIP = 1_000_000;

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const raw = firstValue(value);
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, MIN_LIMIT), max);
}

export function listPageParamsFromQuery(query: Record<string, unknown> = {}): ListPageParams {
  return { limit: query.limit, page: query.page, skip: query.skip };
}

export function boundedListArgs(
  params: ListPageParams = {},
  defaultTake: number = DEFAULT_TAKE
): BoundedListArgs {
  const take = parsePositiveInt(params.limit, defaultTake, MAX_LIMIT);
  const explicitSkip = firstValue(params.skip);
  const skip =
    explicitSkip === undefined || explicitSkip === null || explicitSkip === ""
      ? Math.min((parsePositiveInt(params.page, 1, MAX_SKIP) - 1) * take, MAX_SKIP)
      : Math.min(Math.max(Number.parseInt(String(explicitSkip), 10) || 0, 0), MAX_SKIP);

  return { take, skip };
}
