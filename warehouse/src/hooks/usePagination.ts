import { useState, useMemo } from "react";

interface UsePaginationOptions<T> {
  items: T[];
  pageSize: number;
}

interface UsePaginationResult<T> {
  page: number;
  totalPages: number;
  paginated: T[];
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePagination<T>({ items, pageSize }: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    totalPages,
    paginated,
    setPage: (p) => setPage(Math.max(1, Math.min(p, totalPages))),
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
