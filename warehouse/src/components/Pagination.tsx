interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
        className="btn-ghost btn-xs disabled:opacity-30">
        Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="text-th-muted px-1">...</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p)}
            className={`btn-xs rounded-full w-8 h-8 flex items-center justify-center transition-all ${
              p === page ? "bg-primary-500 text-surface-950 font-bold" : "text-th-secondary hover:bg-th-hover"
            }`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
        className="btn-ghost btn-xs disabled:opacity-30">
        Next
      </button>
    </div>
  );
}
