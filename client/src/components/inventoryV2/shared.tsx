import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatCurrency(n: number): string {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockBadgeClass(qty: number, threshold = 5): string {
  if (qty <= 0) return "badge badge-red";
  if (qty <= threshold) return "badge badge-yellow";
  return "badge badge-green";
}

export function stockTextClass(qty: number, threshold = 5): string {
  if (qty <= 0) return "text-[#e74c3c]";
  if (qty <= threshold) return "text-amber-400";
  return "text-[#1ed760]";
}

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pages, total, pageSize = 20, onPage }: PaginationProps) {
  if (pages <= 1) return null;
  const start = Math.max(0, Math.min(page - 1 - 2, pages - 5));
  const pgs = Array.from({ length: Math.min(pages, 5) }, (_, i) => start + i + 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-sm text-th-secondary">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pgs.map((pg) => (
          <button
            type="button"
            key={pg}
            onClick={() => onPage(pg)}
            className={`w-8 h-8 rounded-[9999px] text-sm font-medium transition-colors ${
              pg === page ? "bg-[#1ed760] text-black" : "hover:bg-th-elevated text-th-secondary"
            }`}
          >
            {pg}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-th-muted">
      <Icon size={44} className="mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
