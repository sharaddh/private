import { useEffect, useState } from "react";
import {
  Plus, Pencil, X, Search, Boxes, Building2, ClipboardList, Loader2, CheckCircle2, XCircle, Save,
} from "lucide-react";
import {
  useV2Brands, useV2Racks, useV2RackItems,
  useCreateRack, useUpdateRack, useCreateBrand, useUpdateBrand,
  useV2CountSessions, useV2CountSession, useCreateCountSession, useUpdateCountEntries,
  useCompleteCountSession, useCancelCountSession,
} from "../../hooks";
import { useToast } from "../../context/ToastContext";
import {
  COUNT_STATUS_LABELS,
  type Brand, type CountEntry, type CountStatus,
} from "../../types/inventoryV2";
import { Pagination, formatDate, formatDateTime, PageSection, inputCls, inputStyle, Field, itemLabel } from "./shared";

const inputStyleShared = inputStyle;

const STATUS_BADGE: Record<CountStatus, string> = {
  draft: "badge badge-yellow",
  completed: "badge badge-green",
  cancelled: "badge badge-red",
};

export default function ManageView({ refreshKey, openCountCreate, onCountCreateHandled }: {
  refreshKey: number;
  openCountCreate: boolean;
  onCountCreateHandled: () => void;
}) {
  return (
    <div className="space-y-5">
      <CountsSection refreshKey={refreshKey} openCountCreate={openCountCreate} onCountCreateHandled={onCountCreateHandled} />
      <RacksSection refreshKey={refreshKey} />
      <BrandsSection refreshKey={refreshKey} />
    </div>
  );
}

// ─── Racks ───────────────────────────────────────────────────────────────────

function RacksSection({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const { racks, loading, refetch } = useV2Racks();
  const { create } = useCreateRack();
  const { update } = useUpdateRack();
  const [modal, setModal] = useState<"create" | { _id: string; code: string; name?: string; section?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { void refetch(); }, [refreshKey, refetch]);

  async function handleSave(data: { code: string; name?: string; section?: string }): Promise<void> {
    setSaving(true);
    try {
      if (modal && modal !== "create") {
        const res = await update(modal._id, data);
        if (res.success) { toast.success("Rack updated"); setModal(null); } else { toast.error(res.message || "Failed to update rack"); }
      } else {
        const res = await create(data);
        if (res.success) { toast.success(`Rack ${data.code} created`); setModal(null); } else { toast.error(res.message || "Failed to create rack"); }
      }
    } catch (err) {
      toast.error((err as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageSection
      icon={Building2}
      title="Racks"
      subtitle="Where items are stored in the shop"
      actions={
        <button onClick={() => setModal("create")} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Rack</button>
      }
    >
      {loading && racks.length === 0 ? (
        <p className="text-center text-th-muted py-8">Loading racks...</p>
      ) : racks.length === 0 ? (
        <p className="text-center text-th-muted py-8">No racks yet. Create one to organise inventory.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {racks.map((r) => (
            <div key={r._id} className="bg-th-base rounded-[8px] border border-th-border p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-base font-bold text-th-text">{r.code}</p>
                  {r.name && <p className="text-sm text-th-secondary">{r.name}</p>}
                  {r.section && <span className="inline-block mt-1 rounded-full bg-th-hover px-2 py-0.5 text-[12px] text-th-secondary">Section {r.section}</span>}
                </div>
                <button onClick={() => setModal({ _id: r._id, code: r.code, name: r.name, section: r.section })} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label={`Edit ${r.code}`}>
                  <Pencil size={15} />
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-th-secondary flex items-center gap-1.5"><Boxes size={14} /> {r.variants ?? 0} variants</span>
                <span className="text-th-text font-semibold">{r.units ?? 0} units</span>
              </div>
              <button onClick={() => setSelectedId(r._id)} className="mt-auto text-sm font-medium text-[#1ed760] hover:underline text-left flex items-center gap-1.5">
                <Search size={13} /> View items
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && <RackFormModal initial={modal === "create" ? undefined : modal} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />}
      {selectedId && <RackItemsModal rackId={selectedId} onClose={() => setSelectedId(null)} />}
    </PageSection>
  );
}

function RackFormModal({ initial, onClose, onSave, saving }: {
  initial?: { _id: string; code: string; name?: string; section?: string };
  onClose: () => void;
  onSave: (data: { code: string; name?: string; section?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [section, setSection] = useState(initial?.section ?? "");

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!code.trim()) return;
    await onSave({ code: code.trim().toUpperCase(), name: name.trim() || undefined, section: section.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-th-text">{initial ? "Edit Rack" : "New Rack"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Code" required>
            <input className={inputCls} style={inputStyleShared} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. R-01" autoFocus />
          </Field>
          <Field label="Name">
            <input className={inputCls} style={inputStyleShared} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Section">
            <input className={inputCls} style={inputStyleShared} value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : initial ? "Save" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RackItemsModal({ rackId, onClose }: { rackId: string; onClose: () => void }) {
  const { detail, loading } = useV2RackItems(rackId);
  const items = detail?.items ?? [];
  const totalUnits = items.reduce((s, v) => s + (v.stockQuantity || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-th-text">Rack Items · {totalUnits} unit(s)</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-th-muted py-8">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-th-muted py-8">No items in this rack</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-th-hover bg-th-base">
                    <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                    <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Item</th>
                    <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-th-border">
                  {items.map((it) => (
                    <tr key={it._id}>
                      <td className="px-3 py-2 font-mono text-sm text-th-text">{it.sku}</td>
                      <td className="px-3 py-2 text-sm text-th-secondary">{it.brandName} {it.model} {it.color}</td>
                      <td className="px-3 py-2 text-right text-sm text-th-text">{it.stockQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Brands ──────────────────────────────────────────────────────────────────

function BrandsSection({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [threshold, setThreshold] = useState(5);
  const { brands, loading, refetch } = useV2Brands(threshold);
  const { create } = useCreateBrand();
  const { update } = useUpdateBrand();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void refetch(); }, [refreshKey, refetch]);

  function openCreate(): void {
    setEditing(null);
    setForm({ name: "", description: "" });
    setModal(true);
  }

  function openEdit(b: Brand): void {
    setEditing(b);
    setForm({ name: b.name, description: b.description || "" });
    setModal(true);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Brand name is required"); return; }
    setSaving(true);
    try {
      const res = editing
        ? await update(editing._id, { name: form.name.trim(), description: form.description.trim() || undefined })
        : await create({ name: form.name.trim(), description: form.description.trim() || undefined });
      if (res.success) { toast.success(editing ? "Brand updated" : "Brand created"); setModal(false); void refetch(); }
      else { toast.error(res.message || "Failed to save brand"); }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageSection
      icon={Building2}
      title="Brands"
      subtitle="Frames, lenses and other brands you stock"
      actions={
        <>
          <select className="input-field w-auto" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Low stock threshold">
            {[3, 5, 10, 20].map((t) => <option key={t} value={t}>Low ≤ {t}</option>)}
          </select>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Brand</button>
        </>
      }
    >
      {loading && brands.length === 0 ? (
        <p className="text-center text-th-muted py-8">Loading brands...</p>
      ) : brands.length === 0 ? (
        <p className="text-center text-th-muted py-8">No brands yet. Add your first brand.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {brands.map((b) => (
            <div key={b._id} className="card p-4 group">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-th-text truncate">{b.name}</p>
                <button type="button" onClick={() => openEdit(b)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Edit ${b.name}`}>
                  <Pencil size={14} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-th-text">{b.variants}</p><p className="text-[11px] text-th-secondary">Items</p></div>
                <div><p className="text-lg font-bold text-th-text">{b.units}</p><p className="text-[11px] text-th-secondary">Units</p></div>
                <div><p className={`text-lg font-bold ${b.lowStock > 0 ? "text-amber-400" : "text-[#1ed760]"}`}>{b.lowStock}</p><p className="text-[11px] text-th-secondary">Low</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-th-text">{editing ? "Edit Brand" : "New Brand"}</h3>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Brand name" required>
                <input className={inputCls} style={inputStyleShared} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Lenskart" autoFocus />
              </Field>
              <Field label="Description">
                <textarea className={inputCls} style={inputStyleShared} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageSection>
  );
}

// ─── Count sessions ──────────────────────────────────────────────────────────

function CountsSection({ refreshKey, openCountCreate, onCountCreateHandled }: {
  refreshKey: number;
  openCountCreate: boolean;
  onCountCreateHandled: () => void;
}) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const { sessions, total, pages, loading, refetch } = useV2CountSessions({ page, limit });
  const { racks } = useV2Racks();
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const rackCode = (id: string): string => racks.find((r) => r._id === id)?.code || "";

  useEffect(() => { void refetch(); }, [refetch, page, refreshKey]);

  useEffect(() => {
    if (openCountCreate) {
      setShowCreate(true);
      onCountCreateHandled();
    }
  }, [openCountCreate, onCountCreateHandled]);

  return (
    <PageSection
      icon={ClipboardList}
      title="Stock Counts"
      subtitle="Physical count sessions to verify and correct stock"
      actions={
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Count Session</button>
      }
    >
      {loading && !sessions.length ? (
        <p className="text-center text-th-muted py-8">Loading count sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="text-center text-th-muted py-8">No count sessions yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <button
              key={s._id}
              onClick={() => setDetailId(s._id)}
              className="w-full bg-th-base rounded-[8px] border border-th-border px-4 py-3 text-left hover:bg-th-hover/40 transition-colors flex flex-wrap items-center gap-x-6 gap-y-1"
            >
              <span className="text-sm text-th-text">Rack <span className="font-semibold">{s.rackLabel || rackCode(s.rackId) || s.rackId.slice(-6)}</span></span>
              <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_BADGE[s.status]}`}>{COUNT_STATUS_LABELS[s.status]}</span>
              <span className="text-sm text-th-secondary">by {s.startedBy}</span>
              <span className="text-sm text-th-secondary">Started {formatDate(s.startedAt)}</span>
              <span className="text-sm text-th-secondary">Counted <span className="text-th-text font-semibold">{s.countedUnits}</span> / {s.expectedUnits}</span>
              <span className="ml-auto text-xs text-th-muted">{s.note || ""}</span>
            </button>
          ))}
        </div>
      )}

      {sessions.length > 0 && <div className="mt-3"><Pagination page={page} pages={pages} total={total} pageSize={limit} onPage={setPage} /></div>}

      {showCreate && <CreateCountModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void refetch(); }} />}
      {detailId && <CountDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={() => void refetch()} />}
    </PageSection>
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
    if (res.success) { toast.success("Count session created"); onCreated(); }
    else { toast.error(res.message || "Failed to create count session"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-th-text">New Count Session</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Rack" required>
            {racksLoading && !racks.length ? (
              <p className="text-sm text-th-secondary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading racks...</p>
            ) : (
              <select className={inputCls} style={inputStyleShared} value={rackId} onChange={(e) => setRackId(e.target.value)} required>
                <option value="">— Select rack —</option>
                {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
              </select>
            )}
          </Field>
          <Field label="Note">
            <input className={inputCls} style={inputStyleShared} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
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
  const { racks } = useV2Racks();
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
    const entries = detail.entries.map((e) => ({ variantId: e.variantId, countedQuantity: counts[e.variantId] ?? e.countedQuantity }));
    const res = await update(detail.session._id, { entries });
    if (res.success) { toast.success("Count entries saved"); void refetch(); }
    else { toast.error(res.message || "Failed to save entries"); }
  }

  async function handleComplete(): Promise<void> {
    if (!detail) return;
    setConfirmComplete(false);
    const res = await complete(detail.session._id, {});
    if (res.success) { toast.success("Count session completed, stock adjusted"); onChanged(); onClose(); }
    else { toast.error(res.message || "Failed to complete session"); }
  }

  async function handleCancel(): Promise<void> {
    if (!detail) return;
    const res = await cancel(detail.session._id);
    if (res.success) { toast.success("Count session cancelled"); onChanged(); onClose(); }
    else { toast.error(res.message || "Failed to cancel session"); }
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
  const rackCode = racks.find((r) => r._id === session.rackId)?.code || "";
  const countFor = (e: CountEntry): number => counts[e.variantId] ?? e.countedQuantity;
  const liveCounted = detail.entries.reduce((s, e) => s + countFor(e), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-th-surface border border-th-border shadow-xl p-6 space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-th-text">Count Session · Rack <span className="font-mono">{session.rackLabel || rackCode || session.rackId.slice(-6)}</span></h3>
            <p className="text-sm text-th-secondary mt-1">
              Status <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_BADGE[session.status]}`}>{COUNT_STATUS_LABELS[session.status]}</span>
              {" · "}Started {formatDateTime(session.startedAt)} by {session.startedBy}
              {session.completedAt ? ` · Completed ${formatDateTime(session.completedAt)}` : ""}
            </p>
            <p className="text-sm text-th-secondary mt-1">
              Counted <span className="font-semibold text-th-text">{isDraft ? liveCounted : session.countedUnits}</span> / {session.expectedUnits} units
              {isDraft && liveCounted !== session.expectedUnits && (
                <span className={`ml-2 text-[12px] font-semibold ${liveCounted > session.expectedUnits ? "text-[#1ed760]" : "text-[#e74c3c]"}`}>
                  ({liveCounted > session.expectedUnits ? `+${liveCounted - session.expectedUnits}` : liveCounted - session.expectedUnits} vs system)
                </span>
              )}
            </p>
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
              {detail.entries.map((e: CountEntry) => {
                const counted = countFor(e);
                const diff = counted - e.expectedQuantity;
                return (
                <tr key={e.variantId}>
                  <td className="px-3 py-2 font-mono text-sm text-th-text">{e.sku}</td>
                  <td className="px-3 py-2 text-sm text-th-secondary max-w-[220px] truncate">{itemLabel(e)}</td>
                  <td className="px-3 py-2 text-right text-sm text-th-text">{e.expectedQuantity}</td>
                  <td className="px-3 py-2 text-right">
                    {isDraft ? (
                      <input
                        type="number"
                        min={0}
                        value={counted}
                        onChange={(ev) => setCounts((prev) => ({ ...prev, [e.variantId]: Number(ev.target.value) }))}
                        className="w-24 ml-auto px-2 py-1 text-right rounded-lg text-sm bg-th-hover text-th-text focus:outline-none focus:ring-1 focus:ring-[#1ed760]"
                        style={inputStyleShared}
                        aria-label={`Count for ${e.sku}`}
                      />
                    ) : (
                      <span className="text-sm text-th-text">{e.countedQuantity}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-sm font-semibold ${diff > 0 ? "text-[#1ed760]" : diff < 0 ? "text-[#e74c3c]" : "text-th-muted"}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-th-border pt-4 flex flex-wrap items-center justify-end gap-2">
          {isDraft ? (
            <>
              <button onClick={() => void handleCancel()} disabled={cancelling} className="btn-ghost flex items-center gap-2 text-[#e74c3c]">
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
