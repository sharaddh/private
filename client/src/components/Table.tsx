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
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-[#1ed760] transition-all duration-200 bg-th-elevated text-th-text placeholder-th-muted text-[14px]"
            style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
          />
        </div>
      )}

      <div className="overflow-x-auto bg-th-surface rounded-[8px]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-th-hover bg-th-base">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3.5 text-left text-[11px] font-semibold text-th-secondary uppercase tracking-wider ${
                    col.sortable !== false ? "cursor-pointer hover:text-th-text select-none" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-th-secondary uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-th-border">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-4 py-16 text-center text-th-secondary"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Search size={28} className="text-[#535353]" />
                    <span className="text-[15px]">No data available</span>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row._id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-th-card transition-colors hover-shine ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-[16px] text-th-text whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3.5 text-sm whitespace-nowrap">
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
          <p className="text-[14px] text-th-secondary">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const pg = start + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-[9999px] text-[14px] font-medium transition-colors ${
                    pg === page
                      ? "bg-[#1ed760] text-black"
                      : "hover:bg-th-elevated text-th-secondary"
                  }`}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
