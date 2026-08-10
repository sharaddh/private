import { useEffect, useState } from "react";
import {
  useV2CountSessions, useV2CountSession, useCreateCountSession,
  useUpdateCountEntries, useCompleteCountSession, useCancelCountSession, useV2Racks,
} from "../../hooks";
import { useToast } from "../../context/ToastContext";
import { COUNT_STATUS_LABELS, type CountSession, type CountEntry, type CountStatus } from "../../types/inventoryV2";
import { Pagination, formatDate, formatDateTime } from "./shared";
import { Plus, X, CheckCircle2, XCircle, Save, ClipboardList, Loader2 } from "lucide-react";

const STATUS_BADGE: Record<CountStatus, string> = {
  draft: "badge badge-yellow",
  completed: "badge badge-green",
  cancelled: "badge badge-red",
};

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover";
const inputStyle = { border: "1px solid rgb(124,124,124)" } as const;

export default function CountTab() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const { sessions, total, pages, loading, refetch } = useV2CountSessions({ page, limit });
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void refetch();
  }, [refetch, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-th-secondary">{total ?? 0} session(s)</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Count Session
        </button>
      </div>

      {loading && !sessions.length ? (
        <p className="text-center text-th-muted py-10">Loading count sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="text-center text-th-muted py-10">No count sessions yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <button
              key={s._id}
              onClick={() => setDetailId(s._id)}
              className="w-full bg-th-surface rounded-[8px] shadow-sm border border-th-border px-4 py-3 text-left hover:bg-th-hover/40 transition-colors flex flex-wrap items-center gap-x-6 gap-y-1"
            >
              <span className="text-sm text-th-text">Rack <span className="font-semibold">{s.rackId.slice(-6)}</span></span>
              <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_BADGE[s.status]}`}>{COUNT_STATUS_LABELS[s.status]}</span>
              <span className="text-sm text-th-secondary">by {s.startedBy}</span>
              <span className="text-sm text-th-secondary">Started {formatDate(s.startedAt)}</span>
              <span className="text-sm text-th-secondary">Counted <span className="text-th-text font-semibold">{s.countedUnits}</span> / {s.expectedUnits}</span>
              <span className="ml-auto text-xs text-th-muted">{s.note || ""}</span>
            </button>
          ))}
        </div>
      )}

      {sessions.length > 0 && <Pagination page={page} pages={pages} total={total} pageSize={limit} onPage={setPage} />}

      {showCreate && <CreateCountModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void refetch(); }} />}
      {detailId && <CountDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={() => void refetch()} />}
    </div>
  );
}

function CreateCountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const { racks, loading: racksLoading } = useV2Racks();
  const { create, loading } = useCreateCountSession();
  const [rackId, setRackId] = useState("");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!rackId) { toast.error("Select a rack"); return; }
    const res = await create({ rackId, note: note.trim() || undefined });
    if (res.success) {
      toast.success("Count session created");
      onCreated();
    } else {
      toast.error(res.message || "Failed to create count session");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-th-text">New Count Session</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Rack *</label>
            {racksLoading && !racks.length ? (
              <p className="text-sm text-th-secondary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading racks...</p>
            ) : (
              <select className={inputCls} style={inputStyle} value={rackId} onChange={(e) => setRackId(e.target.value)} required>
                <option value="">— Select rack —</option>
                {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Note</label>
            <input className={inputCls} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2"><ClipboardList size={15} /> {loading ? "Creating..." : "Start Count"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CountDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { detail, loading, refetch } = useV2CountSession(id);
  const { update, loading: savingEntries } = useUpdateCountEntries();
  const { complete, loading: completing } = useCompleteCountSession();
  const { cancel, loading: cancelling } = useCancelCountSession();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmComplete, setConfirmComplete] = useState(false);

  useEffect(() => {
    if (detail && detail.entries.length > 0) {
      setCounts((prev) => {
        const next: Record<string, number> = {};
        for (const e of detail.entries) next[e.variantId] = prev[e.variantId] ?? e.countedQuantity;
        return next;
      });
    }
  }, [detail]);

  async function handleSave(): Promise<void> {
    if (!detail) return;
    const entries = detail.entries.map((e) => ({ variantId: e.variantId, countedQuantity: counts[e.variantId] ?? 0 }));
    const res = await update(detail.session._id, { entries });
    if (res.success) {
      toast.success("Count entries saved");
      void refetch();
    } else {
      toast.error(res.message || "Failed to save entries");
    }
  }

  async function handleComplete(): Promise<void> {
    if (!detail) return;
    setConfirmComplete(false);
    const res = await complete(detail.session._id, {});
    if (res.success) {
      toast.success("Count session completed, stock adjusted");
      onChanged();
      onClose();
    } else {
      toast.error(res.message || "Failed to complete session");
    }
  }

  async function handleCancel(): Promise<void> {
    if (!detail) return;
    const res = await cancel(detail.session._id);
    if (res.success) {
      toast.success("Count session cancelled");
      onChanged();
      onClose();
    } else {
      toast.error(res.message || "Failed to cancel session");
    }
  }

  if (loading && !detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <p className="text-th-text text-sm">Loading...</p>
      </div>
    );
  }

  if (!detail) return null;

  const session = detail.session;
  const isDraft = session.status === "draft";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-th-text">Count Session · Rack <span className="font-mono">{session.rackId.slice(-6)}</span></h3>
            <p className="text-sm text-th-secondary mt-1">
              Status <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_BADGE[session.status]}`}>{COUNT_STATUS_LABELS[session.status]}</span>
              {" · "}Started {formatDateTime(session.startedAt)} by {session.startedBy}
              {session.completedAt ? ` · Completed ${formatDateTime(session.completedAt)}` : ""}
            </p>
            <p className="text-sm text-th-secondary mt-1">Counted <span className="font-semibold text-th-text">{session.countedUnits}</span> / {session.expectedUnits} units</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Item</th>
                <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Expected</th>
                <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Counted</th>
                <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {detail.entries.map((e: CountEntry) => (
                <tr key={e.variantId}>
                  <td className="px-3 py-2 font-mono text-sm text-th-text">{e.sku}</td>
                  <td className="px-3 py-2 text-sm text-th-secondary">{e.lotId ? `Lot ${e.lotId.slice(-6)}` : "—"}</td>
                  <td className="px-3 py-2 text-right text-sm text-th-text">{e.expectedQuantity}</td>
                  <td className="px-3 py-2 text-right">
                    {isDraft ? (
                      <input
                        type="number"
                        min={0}
                        value={counts[e.variantId] ?? e.countedQuantity}
                        onChange={(ev) => setCounts((prev) => ({ ...prev, [e.variantId]: Number(ev.target.value) }))}
                        className="w-24 ml-auto px-2 py-1 text-right rounded-lg text-sm bg-th-hover text-th-text focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
                        style={inputStyle}
                        aria-label={`Count for ${e.sku}`}
                      />
                    ) : (
                      <span className="text-sm text-th-text">{e.countedQuantity}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-sm font-semibold ${e.difference > 0 ? "text-[#1ed760]" : e.difference < 0 ? "text-[#e74c3c]" : "text-th-muted"}`}>
                      {e.difference > 0 ? `+${e.difference}` : e.difference}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-th-border pt-4 flex flex-wrap items-center justify-end gap-2">
          {isDraft ? (
            <>
              <button onClick={() => handleCancel()} disabled={cancelling} className="btn-ghost flex items-center gap-2 text-[#e74c3c]">
                <XCircle size={15} /> {cancelling ? "Cancelling..." : "Cancel Session"}
              </button>
              <button onClick={() => void handleSave()} disabled={savingEntries} className="btn-ghost flex items-center gap-2">
                <Save size={15} /> {savingEntries ? "Saving..." : "Save Entries"}
              </button>
              <button onClick={() => setConfirmComplete(true)} disabled={completing} className="btn-primary flex items-center gap-2">
                <CheckCircle2 size={15} /> {completing ? "Completing..." : "Complete & Adjust"}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn-primary">Close</button>
          )}
        </div>
      </div>

      {confirmComplete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-th-text">Complete count session</h3>
            <p className="text-sm text-th-secondary">This will adjust stock to match the counted quantities and record movements for all differences. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmComplete(false)} className="btn-ghost">Cancel</button>
              <button onClick={() => void handleComplete()} className="btn-primary">Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
