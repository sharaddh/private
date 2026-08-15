import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, History, Hand } from "lucide-react";
import { useV2Movements, useV2Withdrawals, useReverseWithdrawal } from "../../hooks";
import { useToast } from "../../context/ToastContext";
import { MOVEMENT_TYPES, WITHDRAWAL_REASONS, type MovementListParams, type WithdrawalListParams } from "../../types/inventoryV2";
import { movementLabel, movementTone, formatDateTime } from "./shared";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const REFERENCE_LABELS: Record<string, string> = {
  MANUAL: "Manual entry",
  WITHDRAWAL: "Withdrawal",
  ORDER: "Order",
  INVENTORY_COUNT: "Stock count",
};

export default function HistoryView({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [mode, setMode] = useState<"movements" | "withdrawals">("movements");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit">
        <button
          onClick={() => setMode("movements")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
            mode === "movements" ? "bg-primary-500 text-surface-950 shadow-sm" : "text-th-secondary hover:text-th-text"
          }`}
        >
          <History size={15} /> All Activity
        </button>
        <button
          onClick={() => setMode("withdrawals")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
            mode === "withdrawals" ? "bg-primary-500 text-surface-950 shadow-sm" : "text-th-secondary hover:text-th-text"
          }`}
        >
          <Hand size={15} /> Withdrawals
        </button>
      </div>

      {mode === "movements"
        ? <MovementsList refreshKey={refreshKey} />
        : <WithdrawalsList refreshKey={refreshKey} />}
    </div>
  );
}

function MovementsList({ refreshKey }: { refreshKey: number }) {
  const [params, setParams] = useState<MovementListParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { movements, loading, page, pages, total, refetch } = useV2Movements({
    ...params,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(type ? { type } : {}),
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  });

  useEffect(() => {
    const t = setTimeout(() => setParams((p) => ({ ...p, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search, type, start, end]);

  useEffect(() => { void refetch(); }, [refreshKey, refetch]);

  function go(pageNum: number): void {
    if (pageNum < 1 || pageNum > pages) return;
    setParams((p) => ({ ...p, page: pageNum }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by SKU or item..."
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
          <option value="">All activity types</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{movementLabel(t)}</option>)}
        </select>
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
        <p className="text-center text-th-muted py-10">Loading activity...</p>
      ) : movements.length === 0 ? (
        <p className="text-center text-th-muted py-10">No activity found</p>
      ) : (
        <div className="bg-th-surface rounded-[8px] shadow-sm border border-th-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Type</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-th-secondary uppercase">Source</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-semibold text-th-secondary uppercase">Change</th>
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
                  <td className="px-4 py-2.5"><span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${movementTone(m.type)}`}>{movementLabel(m.type)}</span></td>
                  <td className="px-4 py-2.5 font-mono text-sm text-th-text">{m.sku}</td>
                  <td className="px-4 py-2.5 text-sm text-th-secondary">{REFERENCE_LABELS[m.referenceType] ?? (m.referenceType || "—")}</td>
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

function WithdrawalsList({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [params, setParams] = useState<WithdrawalListParams>({ page: 1, limit: 15 });
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { withdrawals, loading, page, pages, total, refetch } = useV2Withdrawals({
    ...params,
    ...(reason ? { reason } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  useEffect(() => { void refetch(); }, [refreshKey, refetch]);

  const { reverse } = useReverseWithdrawal();

  function changeReason(value: string): void {
    setReason(value);
    setParams((p) => ({ ...p, page: 1 }));
  }
  function changeSearch(value: string): void {
    setSearch(value);
    setParams((p) => ({ ...p, page: 1 }));
  }
  function go(pageNum: number): void {
    if (pageNum < 1 || pageNum > pages) return;
    setParams((p) => ({ ...p, page: pageNum }));
  }

  async function handleReverse(id: string): Promise<void> {
    setConfirmId(null);
    const res = await reverse(id);
    if (res.success) {
      toast.success("Withdrawal reversed, stock restored");
      void refetch();
    } else {
      toast.error(res.message || "Failed to reverse withdrawal");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by SKU, by, or note..."
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
          style={{ border: "1px solid rgb(124,124,124)" }}
        />
        <select
          value={reason}
          onChange={(e) => changeReason(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-th-text bg-th-hover focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
          style={{ border: "1px solid rgb(124,124,124)" }}
        >
          <option value="">All reasons</option>
          {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading && withdrawals.length === 0 ? (
        <p className="text-center text-th-muted py-10">Loading withdrawals...</p>
      ) : withdrawals.length === 0 ? (
        <p className="text-center text-th-muted py-10">No withdrawals found</p>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <div key={w._id} className="bg-th-surface rounded-[8px] shadow-sm border border-th-border overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === w._id ? null : w._id)}
                className="w-full flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-left hover:bg-th-hover/40 transition-colors"
              >
                <span className="text-sm text-th-text">{fmtDate(w.createdAt)}</span>
                <span className="text-sm text-th-secondary">by <span className="text-th-text">{w.by}</span></span>
                <span className="text-sm text-th-secondary">{w.reason}</span>
                <span className="text-sm text-th-secondary">{w.items.length} item{w.items.length === 1 ? "" : "s"}</span>
                <span className="text-sm text-th-secondary">Qty: <span className="text-th-text font-semibold">{w.totalQty}</span></span>
                <span className="text-sm text-th-secondary">Value: <span className="text-th-text font-semibold">{w.totalPrice.toLocaleString()}</span></span>
                <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${w.reversed ? "bg-th-hover text-th-muted" : "bg-[#1ed760]/10 text-[#1ed760]"}`}>
                  {w.reversed ? "Reversed" : "Active"}
                </span>
                <span className="text-th-secondary">{expanded === w._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>

              {expanded === w._id && (
                <div className="border-t border-th-border">
                  {w.note && <p className="px-4 py-2 text-sm text-th-secondary bg-th-hover/30">Note: {w.note}</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-th-hover bg-th-base">
                          <th className="px-4 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                          <th className="px-4 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Item</th>
                          <th className="px-4 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                          <th className="px-4 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-th-border">
                        {w.items.map((it, idx) => (
                          <tr key={it.variantId ?? idx}>
                            <td className="px-4 py-2 font-mono text-sm text-th-text">{it.sku}</td>
                            <td className="px-4 py-2 text-sm text-th-secondary">{it.brand} {it.model} {it.color}</td>
                            <td className="px-4 py-2 text-right text-sm text-th-text">{it.quantity}</td>
                            <td className="px-4 py-2 text-right text-sm text-th-text">{it.price.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!w.reversed && (
                    <div className="px-4 py-3 border-t border-th-border bg-th-base">
                      <button
                        onClick={() => setConfirmId(w._id)}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#e74c3c] hover:bg-[#e74c3c]/10 transition-colors"
                      >
                        <RotateCcw size={15} /> Reverse this withdrawal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => go(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm text-th-secondary hover:bg-th-hover disabled:opacity-30">Prev</button>
          <span className="text-sm text-th-secondary">Page {page} of {pages} · {total} total</span>
          <button onClick={() => go(page + 1)} disabled={page >= pages} className="px-3 py-1.5 rounded-lg text-sm text-th-secondary hover:bg-th-hover disabled:opacity-30">Next</button>
        </div>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-th-text">Reverse withdrawal</h3>
            <p className="text-sm text-th-secondary">This restores the withdrawn stock back to inventory. The withdrawal will be marked as reversed.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => void handleReverse(confirmId)} className="btn-primary">Reverse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
