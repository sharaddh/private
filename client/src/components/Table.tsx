import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  sortable?: boolean;
}

interface TableProps {
  columns: Column[];
  data: any[];
  actions?: (row: any) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: any) => void;
}

export default function Table({
  columns,
  data,
  actions,
  searchable = true,
  searchPlaceholder = "Search...",
  pageSize = 10,
  onRowClick,
}: TableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="input-field pl-10"
          />
        </div>
      )}

      <div className="overflow-x-auto bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-2xl border border-surface-200/50 dark:border-dark-600/30 shadow-glass">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200/50 dark:border-dark-600/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider ${
                    col.sortable !== false ? "cursor-pointer hover:text-muted-700 dark:hover:text-muted-300 select-none" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th                 className="px-4 py-4 text-left text-xs font-semibold text-muted-500 dark:text-muted-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200/40 dark:divide-dark-600/20">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-muted-400 dark:text-muted-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search size={24} className="text-muted-300 dark:text-muted-600" />
                    <span>No data available</span>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row._id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-surface-100/40 dark:hover:bg-dark-700/40 transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4 text-sm text-muted-700 dark:text-muted-300 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const pg = start + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${
                    pg === page
                      ? "bg-primary-600 text-white"
                      : "hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
