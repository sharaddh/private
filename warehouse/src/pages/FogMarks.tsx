import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { Tags, Plus, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";
import { useToast } from "../context/ToastContext";
import type { FogMark } from "../types/fogMark";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import Badge from "../components/Badge";
import Modal from "../components/Modal";

export default function FogMarks() {
  const [marks, setMarks] = useState<FogMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FogMark | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FogMark | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchMarks = useCallback(async () => {
    setLoading(true);
    const res = await api.get<FogMark[]>("/api/fog-marks");
    if (res.success && Array.isArray(res.data)) setMarks(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  function openAdd() {
    setEditing(null);
    setName("");
    setShowForm(true);
  }

  function openEdit(mark: FogMark) {
    setEditing(mark);
    setName(mark.name);
    setShowForm(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Name is required", "error"); return; }
    setSaving(true);
    const res = editing
      ? await api.put(`/api/fog-marks/${editing._id}`, { name: trimmed })
      : await api.post("/api/fog-marks", { name: trimmed });
    setSaving(false);
    if (res.success) {
      toast(editing ? "Fog mark updated" : "Fog mark added", "success");
      setShowForm(false);
      setEditing(null);
      setName("");
      fetchMarks();
    } else {
      toast(res.message || "Failed to save", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.del(`/api/fog-marks/${deleteTarget._id}`);
    setDeleting(false);
    if (res.success) {
      toast("Fog mark deleted", "success");
      setDeleteTarget(null);
      fetchMarks();
    } else {
      toast(res.message || "Failed to delete", "error");
    }
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <Tags size={22} className="text-primary-500" />
          </div>
          <div className="min-w-0">
            <h1 className="page-title leading-tight">Fog Marks</h1>
            <p className="page-subtitle">{marks.length} mark{marks.length !== 1 ? "s" : ""} available to select in cart</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 shrink-0 px-4 sm:px-6">
          <Plus size={18} /> Add Mark
        </button>
      </div>

      {loading ? (
        <Spinner size={32} className="mx-auto mt-16" />
      ) : marks.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No fog marks yet"
          message="Add marks like HD PX, HD Pixi, Super to select them in the cart"
          action={{ label: "Add First Mark", onClick: openAdd }}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-border bg-th-base">
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Name</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Created</th>
                  <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((mark) => (
                  <tr key={mark._id} className="border-b border-th-border hover:bg-th-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-body-bold text-th-text">{mark.name}</span>
                        <Badge variant="blue">Fog</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-small text-th-muted">
                      {new Date(mark.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(mark)}
                          className="p-2 hover:bg-th-hover rounded-lg text-th-muted hover:text-announcement transition-colors" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(mark)}
                          className="p-2 hover:bg-th-hover rounded-lg text-th-muted hover:text-negative transition-colors" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2 p-3">
            {marks.map((mark) => (
              <div key={mark._id} className="flex items-center justify-between gap-2 bg-th-elevated rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-body-bold text-th-text truncate">{mark.name}</p>
                  <p className="text-small text-th-muted">
                    {new Date(mark.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(mark)}
                    className="w-9 h-9 rounded-lg bg-th-elevated text-th-muted flex items-center justify-center active:scale-90 transition-all hover:text-announcement" title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteTarget(mark)}
                    className="w-9 h-9 rounded-lg bg-th-elevated text-th-muted flex items-center justify-center active:scale-90 transition-all hover:text-negative" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? "Edit Fog Mark" : "Add Fog Mark"}
        size="sm"
      >
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-small font-bold text-th-secondary mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="e.g. HD PX, HD Pixi, Super"
              className="w-full px-3.5 py-2.5 rounded-xl bg-th-base border border-th-border text-body text-th-text outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-ghost flex items-center gap-1.5">
              <X size={16} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
              <Check size={16} /> {saving ? "Saving..." : editing ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Fog Mark"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 bg-th-elevated rounded-lg p-3">
            <AlertTriangle size={18} className="text-warning mt-0.5 shrink-0" />
            <p className="text-body text-th-text">
              Delete <span className="font-bold">"{deleteTarget?.name}"</span>? Existing cart items keep their selection but it won't appear as an option.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex items-center gap-1.5">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger flex items-center gap-1.5 disabled:opacity-50">
              <Trash2 size={16} /> {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
