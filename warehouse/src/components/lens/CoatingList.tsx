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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-th-text uppercase tracking-wider">Coatings</h3>
        <button
          onClick={() => { setAdding(true); setNewName(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 text-surface-950 text-xs font-bold hover:bg-primary-400 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={14} strokeWidth={2.5} />
          Add
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-3 p-2.5 rounded-lg bg-th-input border border-th-border">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            className="flex-1 px-2.5 py-1.5 text-sm bg-transparent text-th-text placeholder:text-th-muted focus:outline-none"
            placeholder="Coating name..."
          />
          <button onClick={handleAdd} className="p-1.5 rounded-md bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 rounded-md bg-th-elevated text-th-muted hover:text-th-text transition-colors">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin space-y-1.5">
        {items.map((item) => {
          const totalQty = getTotalQty(item);
          const isSelected = item._id === selectedId;
          const isEditing = item._id === editingId;

          return (
            <div
              key={item._id}
              onClick={() => !isEditing && onSelect(item._id)}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "bg-primary-500/10 border border-primary-500/30 shadow-sm ring-1 ring-primary-500/10"
                  : "hover:bg-th-elevated border border-transparent hover:border-th-border"
              }`}
            >
              <div className={`w-1 h-10 rounded-sm flex-shrink-0 transition-colors ${
                isSelected ? "bg-primary-500" : "bg-th-border group-hover:bg-th-muted"
              }`} />

              {isEditing ? (
                <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(item._id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 px-2.5 py-1.5 text-sm bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
                  />
                  <button onClick={() => handleRename(item._id)} className="p-1.5 text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors">
                    <Check size={14} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-th-muted hover:bg-th-elevated rounded-lg transition-colors">
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isSelected ? "text-th-text" : "text-th-secondary group-hover:text-th-text"}`}>
                      {item.coating}
                    </div>
                    <div className={`text-xs mt-0.5 font-medium ${
                      totalQty > 0 ? "text-primary-500" : "text-th-muted"
                    }`}>
                      {totalQty > 0 ? `${totalQty} in stock` : "Empty"}
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingId(item._id); setEditName(item.coating); }}
                      className="p-1.5 text-th-muted hover:text-th-text hover:bg-th-elevated rounded-lg transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.coating)}
                      className="p-1.5 text-th-muted hover:text-negative hover:bg-negative/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-th-elevated flex items-center justify-center mb-3">
              <Plus size={18} className="text-th-muted" />
            </div>
            <p className="text-th-muted text-sm font-medium mb-1">No coatings yet</p>
            <button
              onClick={() => { setAdding(true); setNewName(""); }}
              className="text-primary-500 text-sm font-semibold hover:underline"
            >
              Add your first coating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
