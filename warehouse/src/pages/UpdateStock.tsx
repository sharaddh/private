import { useState, useEffect } from "react";
import type { LensStockItem } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import CoatingList from "../components/lens/CoatingList";
import LensGrid from "../components/lens/LensGrid";
import { PageLoader } from "../components";
import { PackagePlus } from "lucide-react";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
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
  }

  const selectedItem = items.find((i) => i._id === selectedId) || null;

  const handleAdd = (item: LensStockItem) => {
    setItems((prev) => [...prev, item]);
    setSelectedId(item._id);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
    if (selectedId === id) {
      setSelectedId(items.length > 1 ? items.find((i) => i._id !== id)!._id : null);
    }
  };

  const handleRename = (id: string, coating: string) => {
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, coating } : i)));
  };

  const handleGridUpdate = (updated: LensStockItem) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
  };

  if (loading) return <PageLoader />;

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0">
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
        </div>
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
