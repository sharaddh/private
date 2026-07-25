import { useState, useEffect } from "react";
import type { LensStockItem } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import CoatingList from "../components/lens/CoatingList";
import LensGrid from "../components/lens/LensGrid";
import { PageLoader, EmptyState } from "../components";
import { Glasses } from "lucide-react";

export default function LensStock() {
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const res = await api.get<LensStockItem[]>("/api/lens-stock");
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
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center">
          <Glasses size={18} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-feature font-bold text-th-text leading-tight">Lens Stock</h1>
          <p className="text-micro text-th-muted">{items.length} coating{items.length !== 1 ? "s" : ""} available</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-60 shrink-0 card p-3 flex flex-col overflow-hidden">
          <CoatingList
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>

        <div className="flex-1 card p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-th-border">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-body-bold text-th-text">{selectedItem.coating}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <LensGrid item={selectedItem} onUpdate={handleGridUpdate} />
              </div>
            </>
          ) : (
            <EmptyState
              icon={Glasses}
              title="Select a coating"
              message="Choose a coating from the sidebar to view and manage stock"
            />
          )}
        </div>
      </div>
    </div>
  );
}
