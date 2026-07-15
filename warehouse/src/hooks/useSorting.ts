import { useState, useMemo } from "react";

interface UseSortingOptions<T> {
  items: T[];
  defaultKey?: keyof T;
  defaultDir?: "asc" | "desc";
}

interface UseSortingResult<T> {
  sortBy: keyof T;
  sortDir: "asc" | "desc";
  sorted: T[];
  setSortBy: (key: keyof T) => void;
  toggleSortDir: () => void;
}

export function useSorting<T>({ items, defaultKey, defaultDir = "asc" }: UseSortingOptions<T>): UseSortingResult<T> {
  const [sortBy, setSortBy] = useState<keyof T>(defaultKey || ("" as keyof T));
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    if (!sortBy) return items;
    return [...items].sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortBy, sortDir]);

  return {
    sortBy,
    sortDir,
    sorted,
    setSortBy: (key) => { setSortBy(key); },
    toggleSortDir: () => setSortDir((d) => d === "asc" ? "desc" : "asc"),
  };
}
