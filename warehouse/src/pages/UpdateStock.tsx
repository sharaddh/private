import { useState, useEffect, useCallback, useMemo } from "react";
import type { LensStockItem } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import CoatingList from "../components/lens/CoatingList";
import LensGrid from "../components/lens/LensGrid";
import { PageLoader } from "../components";
import { PackagePlus, Plus, Check, X } from "lucide-react";

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

export default function UpdateStock() {
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileAdding, setMobileAdding] = useState(false);
  const [mobileNewName, setMobileNewName] = useState("");
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get<LensStockItem[]>("/api/warehouse/lens-stock");
    if (res.success && res.data) {
      setItems(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0]._id);
      }
    } else {
      toast(res.message || "Failed to load lens stock", "error");
    }
    setLoading(false);
  }, [selectedId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const selectedItem = useMemo(() => items.find((i) => i._id === selectedId) || null, [items, selectedId]);

  const handleAdd = useCallback((item: LensStockItem) => {
    setItems((prev) => [...prev, item]);
    setSelectedId(item._id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i._id !== id);
      if (selectedId === id) {
        setSelectedId(next.length > 0 ? next[0]._id : null);
      }
      return next;
    });
  }, [selectedId]);

  const handleRename = useCallback((id: string, coating: string) => {
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, coating } : i)));
  }, []);

  const handleGridUpdate = useCallback((updated: LensStockItem) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
  }, []);

  const handleMobileAdd = useCallback(async () => {
    const name = mobileNewName.trim();
    if (!name) return;
    const res = await api.post<LensStockItem>("/api/warehouse/lens-stock", { coating: name });
    if (res.success && res.data) {
      setItems((prev) => [...prev, res.data!]);
      setSelectedId(res.data!._id);
      setMobileNewName("");
      setMobileAdding(false);
      toast("Coating added", "success");
    } else {
      toast(res.message || "Failed to add", "error");
    }
  }, [mobileNewName, toast]);

  if (loading) return <PageLoader />;

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center">
          <PackagePlus size={18} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-feature font-bold text-th-text leading-tight">Update Stock</h1>
          <p className="text-micro text-th-muted">{items.length} coating{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Mobile: coating strip */}
      <div className="lg:hidden">
        {mobileAdding ? (
          <div className="flex gap-2 mb-2">
            <input
              autoFocus
              value={mobileNewName}
              onChange={(e) => setMobileNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMobileAdd(); if (e.key === "Escape") { setMobileAdding(false); setMobileNewName(""); } }}
              className="flex-1 px-3 py-2 rounded-xl bg-th-input border border-th-border text-sm font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
              placeholder="Coating name..."
            />
            <button onClick={handleMobileAdd} className="p-2 rounded-xl bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
              <Check size={18} strokeWidth={2.5} />
            </button>
            <button onClick={() => { setMobileAdding(false); setMobileNewName(""); }} className="p-2 rounded-xl bg-th-elevated text-th-muted hover:text-th-text transition-colors">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {items.map((item) => {
              const total = getTotalQty(item);
              const isSelected = item._id === selectedId;
              return (
                <button
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/10"
                      : "border-th-border hover:border-th-border-med bg-th-surface"
                  }`}
                >
                  <span className={`text-xs font-bold truncate max-w-[80px] ${isSelected ? "text-th-text" : "text-th-secondary"}`}>
                    {item.coating}
                  </span>
                  <span className={`text-micro font-medium ${total > 0 ? "text-primary-500" : "text-th-muted"}`}>
                    {total > 0 ? total : "Empty"}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => { setMobileAdding(true); setMobileNewName(""); }}
              className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl border border-dashed border-th-border hover:border-primary-500/50 bg-th-surface hover:bg-primary-500/5 transition-all"
            >
              <Plus size={16} className="text-primary-500" />
              <span className="text-xs font-bold text-th-muted">Add</span>
            </button>
          </div>
        )}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-56 shrink-0 card p-4 flex-col overflow-hidden">
          <CoatingList
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>

        <div className="flex-1 card p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-th-border">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-sm lg:text-body-bold font-bold text-th-text truncate">{selectedItem.coating}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <LensGrid item={selectedItem} onUpdate={handleGridUpdate} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-th-muted text-body">Select a coating to update</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
