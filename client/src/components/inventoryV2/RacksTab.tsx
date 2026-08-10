import { useState } from "react";
import {
  useV2Racks, useCreateRack, useUpdateRack, useV2RackItems,
} from "../../hooks";
import { useToast } from "../../context/ToastContext";
import { Plus, Pencil, X, Search, Boxes } from "lucide-react";

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover";
const inputStyle = { border: "1px solid rgb(124,124,124)" } as const;
const labelCls = "block text-sm font-medium text-th-secondary mb-1.5";

function RackFormModal({
  initial, onClose, onSave, saving,
}: {
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
          <div>
            <label className={labelCls}>Code *</label>
            <input className={inputCls} style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. R-01" autoFocus required />
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Section</label>
            <input className={inputCls} style={inputStyle} value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : initial ? "Save" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RacksTab() {
  const toast = useToast();
  const { racks, loading, refetch } = useV2Racks();
  const { create } = useCreateRack();
  const { update } = useUpdateRack();
  const [modal, setModal] = useState<"create" | { _id: string; code: string; name?: string; section?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleSave(data: { code: string; name?: string; section?: string }): Promise<void> {
    setSaving(true);
    try {
      if (modal && modal !== "create") {
        const res = await update(modal._id, data);
        if (res.success) {
          toast.success("Rack updated");
          setModal(null);
        } else {
          toast.error(res.message || "Failed to update rack");
        }
      } else {
        const res = await create(data);
        if (res.success) {
          toast.success(`Rack ${data.code} created`);
          setModal(null);
        } else {
          toast.error(res.message || "Failed to create rack");
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-th-secondary">{racks.length} rack(s)</p>
        <button onClick={() => setModal("create")} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Rack
        </button>
      </div>

      {loading && racks.length === 0 ? (
        <p className="text-center text-th-muted py-10">Loading racks...</p>
      ) : racks.length === 0 ? (
        <p className="text-center text-th-muted py-10">No racks yet. Create one to organize inventory.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {racks.map((r) => (
            <div key={r._id} className="bg-th-surface rounded-[8px] shadow-sm border border-th-border p-4 flex flex-col gap-3">
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
