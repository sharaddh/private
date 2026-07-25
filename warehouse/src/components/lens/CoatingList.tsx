import { useState } from "react";
import type { LensStockItem } from "../../types/lensStock";
import api from "../../api";
import { useToast } from "../../context";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

interface Props {
  items: LensStockItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (item: LensStockItem) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, coating: string) => void;
}

function getTotalQty(item: LensStockItem): number {
  const q = item.quantities as Record<string, Record<string, number>> || {};
  let total = 0;
  for (const lensType of ["sph", "cyl", "compound"]) {
    const map = q[lensType];
    if (map) {
      for (const v of Object.values(map)) {
        total += (v as number);
      }
    }
  }
  return total;
}

export default function CoatingList({ items, selectedId, onSelect, onAdd, onDelete, onRename }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const res = await api.post<LensStockItem>("/api/lens-stock", { coating: name });
    if (res.success && res.data) {
      onAdd(res.data);
      setNewName("");
      setAdding(false);
      toast("Coating added", "success");
    } else {
      toast(res.message || "Failed to add", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await api.del(`/api/lens-stock/${id}`);
    if (res.success) {
      onDelete(id);
      toast("Coating deleted", "success");
    } else {
      toast(res.message || "Failed to delete", "error");
    }
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const res = await api.put<LensStockItem>(`/api/lens-stock/${id}`, { coating: name });
    if (res.success) {
      onRename(id, name);
      setEditingId(null);
      toast("Renamed", "success");
    } else {
      toast(res.message || "Failed to rename", "error");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-caption-bold text-th-text">Coatings</h3>
        <button
          onClick={() => { setAdding(true); setNewName(""); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-primary-500 text-surface-950 text-micro font-bold hover:bg-primary-400 active:scale-95 transition-all"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {adding && (
        <div className="flex gap-1.5 mb-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            className="flex-1 px-3 py-1.5 text-small bg-th-input text-th-text border border-th-border rounded-xs focus:outline-none focus:border-primary-500"
            placeholder="Enter coating name..."
          />
          <button onClick={handleAdd} className="px-2 py-1 rounded-xs bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
            <Check size={14} />
          </button>
          <button onClick={() => setAdding(false)} className="px-2 py-1 rounded-xs bg-th-elevated text-th-muted hover:text-th-text transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin space-y-1">
        {items.map((item) => {
          const totalQty = getTotalQty(item);
          const isSelected = item._id === selectedId;
          const isEditing = item._id === editingId;

          return (
            <div
              key={item._id}
              onClick={() => !isEditing && onSelect(item._id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
                isSelected
                  ? "bg-primary-500/10 border border-primary-500/30 shadow-sm"
                  : "hover:bg-th-elevated border border-transparent"
              }`}
            >
              {isEditing ? (
                <div className="flex-1 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(item._id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 px-2 py-1 text-small bg-th-input text-th-text border border-th-border rounded-xs focus:outline-none focus:border-primary-500"
                  />
                  <button onClick={() => handleRename(item._id)} className="p-1 text-primary-500 hover:bg-primary-500/10 rounded transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-th-muted hover:bg-th-elevated rounded transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${isSelected ? "bg-primary-500" : "bg-th-border"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-small font-semibold text-th-text truncate">{item.coating}</div>
                    <div className={`text-micro ${totalQty > 0 ? "text-primary-500 font-semibold" : "text-th-muted"}`}>
                      {totalQty} pcs
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingId(item._id); setEditName(item.coating); }}
                      className="p-1 text-th-muted hover:text-th-text hover:bg-th-elevated rounded transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.coating)}
                      className="p-1 text-th-muted hover:text-negative hover:bg-negative/10 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center text-th-muted text-micro py-8">
            <p className="mb-2">No coatings yet</p>
            <button
              onClick={() => { setAdding(true); setNewName(""); }}
              className="text-primary-500 text-small font-semibold hover:underline"
            >
              + Add your first coating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
