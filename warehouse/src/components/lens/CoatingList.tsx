import { useState } from "react";
import type { LensStockItem } from "../../types/lensStock";
import api from "../../api";
import { useToast } from "../../context";
import { formatCurrency } from "../../utils/helpers";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

interface Props {
  items: LensStockItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (item: LensStockItem) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, coating: string, priceNeg: number, pricePos: number) => void;
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
  const [newPriceNeg, setNewPriceNeg] = useState("");
  const [newPricePos, setNewPricePos] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriceNeg, setEditPriceNeg] = useState("");
  const [editPricePos, setEditPricePos] = useState("");
  const { toast } = useToast();

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const priceNeg = newPriceNeg.trim() === "" ? 0 : Number(newPriceNeg);
    const pricePos = newPricePos.trim() === "" ? 0 : Number(newPricePos);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast("Enter valid prices", "error");
      return;
    }
    const res = await api.post<LensStockItem>("/api/warehouse/lens-stock", { coating: name, priceNeg, pricePos });
    if (res.success && res.data) {
      onAdd(res.data);
      setNewName("");
      setNewPriceNeg("");
      setNewPricePos("");
      setAdding(false);
      toast("Coating added", "success");
    } else {
      toast(res.message || "Failed to add", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await api.del(`/api/warehouse/lens-stock/${id}`);
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
    const priceNeg = editPriceNeg.trim() === "" ? 0 : Number(editPriceNeg);
    const pricePos = editPricePos.trim() === "" ? 0 : Number(editPricePos);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast("Enter valid prices", "error");
      return;
    }
    const res = await api.put<LensStockItem>(`/api/warehouse/lens-stock/${id}`, { coating: name, priceNeg, pricePos });
    if (res.success) {
      onRename(id, name, priceNeg, pricePos);
      setEditingId(null);
      toast("Renamed", "success");
    } else {
      toast(res.message || "Failed to rename", "error");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-small font-bold text-th-text uppercase tracking-wider">Coatings</h3>
        <button type="button"
          onClick={() => { setAdding(true); setNewName(""); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-500 text-surface-950 text-small font-bold hover:bg-primary-400 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 mb-3 p-2.5 rounded-lg bg-th-input border border-th-border">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewPriceNeg(""); setNewPricePos(""); } }}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-small bg-transparent text-th-text placeholder:text-th-muted focus:outline-none"
              placeholder="Coating name..."
            />
            <button type="button" onClick={handleAdd} className="p-2 rounded-md bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
              <Check size={16} strokeWidth={2.5} />
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewPriceNeg(""); setNewPricePos(""); }} className="p-2 rounded-md bg-th-elevated text-th-muted hover:text-th-text transition-colors">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-small font-bold text-th-muted">−₹</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={newPriceNeg}
              onChange={(e) => setNewPriceNeg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              className="flex-1 min-w-0 px-2.5 py-1 text-small bg-transparent text-th-text placeholder:text-th-muted focus:outline-none"
              placeholder="Neg price"
            />
            <span className="text-small font-bold text-th-muted">+₹</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={newPricePos}
              onChange={(e) => setNewPricePos(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              className="flex-1 min-w-0 px-2.5 py-1 text-small bg-transparent text-th-text placeholder:text-th-muted focus:outline-none"
              placeholder="Pos price"
            />
          </div>
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
                <div className="flex-1 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(item._id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-small bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
                    />
                    <button type="button" onClick={() => handleRename(item._id)} className="p-2 text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors">
                      <Check size={16} strokeWidth={2.5} />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-2 text-th-muted hover:bg-th-elevated rounded-lg transition-colors">
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-small font-bold text-th-muted">−₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPriceNeg}
                      onChange={(e) => setEditPriceNeg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(item._id); }}
                      className="flex-1 min-w-0 px-2 py-1 text-small bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
                    />
                    <span className="text-small font-bold text-th-muted">+₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPricePos}
                      onChange={(e) => setEditPricePos(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(item._id); }}
                      className="flex-1 min-w-0 px-2 py-1 text-small bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className={`text-small-bold truncate ${isSelected ? "text-th-text" : "text-th-secondary group-hover:text-th-text"}`}>
                      {item.coating}
                    </div>
                    <div className={`text-small mt-0.5 font-medium ${
                      totalQty > 0 ? "text-primary-500" : "text-th-muted"
                    }`}>
                      {totalQty > 0 ? `${totalQty} in stock` : "Empty"}
                    </div>
                    <div className="text-small mt-0.5 font-bold text-th-muted">−{formatCurrency(item.priceNeg ?? 0)} / +{formatCurrency(item.pricePos ?? 0)}</div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button type="button"
                      onClick={() => { setEditingId(item._id); setEditName(item.coating); setEditPriceNeg(String(item.priceNeg ?? item.price ?? 0)); setEditPricePos(String(item.pricePos ?? item.price ?? 0)); }}
                      className="p-2 text-th-muted hover:text-th-text hover:bg-th-elevated rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button type="button"
                      onClick={() => handleDelete(item._id, item.coating)}
                      className="p-2 text-th-muted hover:text-negative hover:bg-negative/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-th-elevated flex items-center justify-center mb-3">
              <Plus size={20} className="text-th-muted" />
            </div>
            <p className="text-th-muted text-small font-medium mb-1">No coatings yet</p>
            <button type="button"
              onClick={() => { setAdding(true); setNewName(""); }}
              className="text-primary-500 text-small font-semibold hover:underline"
            >
              Add your first coating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
