import { useEffect, useState } from "react";
import { useV2Movements } from "../../hooks";
import { MOVEMENT_TYPES, type MovementListParams } from "../../types/inventoryV2";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const TYPE_STYLES: Record<string, string> = {
  STOCK_IN: "bg-[#1ed760]/10 text-[#1ed760]",
  CREATED: "bg-[#1ed760]/10 text-[#1ed760]",
  STOCK_OUT: "bg-[#f39c12]/10 text-[#f39c12]",
  WITHDRAWAL: "bg-[#f39c12]/10 text-[#f39c12]",
  WITHDRAWAL_REVERSED: "bg-[#f39c12]/10 text-[#f39c12]",
  ADJUSTMENT: "bg-[#3498db]/10 text-[#3498db]",
  DAMAGED: "bg-[#e74c3c]/10 text-[#e74c3c]",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${TYPE_STYLES[type] ?? "bg-th-hover text-th-secondary"}`}>
      {type}
    </span>
  );
}

function fmtRef(ref: { type: string; id: string } | undefined): string {
  if (!ref) return "—";
  return ref.id ? `${ref.type}:${ref.id.slice(0, 8)}` : ref.type;
}

export default function MovementsTab() {
  const [params, setParams] = useState<MovementListParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [rackId, setRackId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { movements, loading, page, pages, total } = useV2Movements({
    ...params,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(type ? { type: type as MovementListParams["type"] } : {}),
    ...(rackId ? { rackId } : {}),
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  });

  useEffect(() => {
    // Debounce the search reset
    const t = setTimeout(() => setParams((p) => ({ ...p, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search, type, rackId, start, end]);

  function go(pageNum: number): void {
    if (pageNum < 1 || pageNum > pages) return;
    setParams((p) => ({ ...p, page: pageNum }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[150px] px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
          style={{ border: "1px solid rgb(124,124,124)" }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-th-text bg-th-hover focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
          style={{ border: "1px solid rgb(124,124,124)" }}
        >
          <option value="">All types</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          placeholder="Rack ID"
          value={rackId}
          onChange={(e) => setRackId(e.target.value)}
          className="w-40 px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
          style={{ border: "1px solid rgb(124,124,124)" }}
        />
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-th-text bg-th-hover focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
          style={{ border: "1px solid rgb(124,124,124)" }}
        />
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-th-text bg-th-hover focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
          style={{ border: "1px solid rgb(124,124,124)" }}
        />
      </div>

      {loading && movements.length === 0 ? (
        <p className="text-center text-th-muted py-10">Loading movements...</p>
      ) : movements.length === 0 ? (
        <p className="text-center text-th-muted py-10">No movements found</p>
      ) : (
        <div className="bg-th-surface rounded-[8px] shadow-sm border border-th-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Type</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Item</th>                <th className="px-4 py-2.5 text-right text-[12px] font-semibold text-th-secondary uppercase">Change</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-semibold text-th-secondary uppercase">After</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Rack</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">By</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Note</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {movements.map((m) => (
                <tr key={m._id} className="hover:bg-th-hover/30 transition-colors">
                  <td className="px-4 py-2.5"><TypeBadge type={m.type} /></td>
                  <td className="px-4 py-2.5 font-mono text-sm text-th-text">{m.sku}</td>
                  <td className="px-4 py-2.5 text-sm text-th-secondary">{m.referenceType || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-semibold ${m.quantity > 0 ? "text-[#1ed760]" : "text-[#e74c3c]"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-th-text">{m.afterQuantity}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-th-secondary">{m.rackLabel || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-th-secondary">{m.by || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-th-secondary max-w-[200px] truncate">{m.note || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-th-secondary whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => go(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm text-th-secondary hover:bg-th-hover disabled:opacity-30">Prev</button>
          <span className="text-sm text-th-secondary">Page {page} of {pages} · {total} total</span>
          <button onClick={() => go(page + 1)} disabled={page >= pages} className="px-3 py-1.5 rounded-lg text-sm text-th-secondary hover:bg-th-hover disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
