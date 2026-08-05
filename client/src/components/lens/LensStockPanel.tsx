import { useEffect, useCallback, useMemo, useState } from "react";
import { lensStockService } from "../../services";
import { useToast } from "../../context/ToastContext";
import type { LensStockItem, LensStockScope } from "../../types";
import { getTotalQty } from "./powers";
import CoatingList from "./CoatingList";
import LensGrid from "./LensGrid";
import { Glasses, Plus, Check, X } from "lucide-react";

export default function LensStockPanel() {
  const [scope, setScope] = useState<LensStockScope>("shop");
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileAdding, setMobileAdding] = useState(false);
  const [mobileNewName, setMobileNewName] = useState("");
  const [mobileNewPriceNeg, setMobileNewPriceNeg] = useState("");
  const [mobileNewPricePos, setMobileNewPricePos] = useState("");
  const toast = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await lensStockService.list(scope);
    if (res.success && res.data) {
      setItems(res.data);
      setSelectedId((prev) => {
        if (prev && res.data!.some((i) => i._id === prev)) return prev;
        return res.data!.length > 0 ? res.data![0]._id : null;
      });
    } else {
      toast.error(res.message || "Failed to load lens stock");
    }
    setLoading(false);
  }, [scope, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const selectedItem = useMemo(() => items.find((i) => i._id === selectedId) || null, [items, selectedId]);

  const handleAdd = useCallback((item: LensStockItem) => {
    setItems((prev) => [...prev, item]);
    setSelectedId(item._id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const next = items.filter((i) => i._id !== id);
    setItems(next);
    if (selectedId === id) {
      setSelectedId(next.length > 0 ? next[0]._id : null);
    }
  }, [items, selectedId]);

  const handleRename = useCallback((id: string, coating: string, priceNeg: number, pricePos: number) => {
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, coating, priceNeg, pricePos, price: priceNeg } : i)));
  }, []);

  const handleGridUpdate = useCallback((updated: LensStockItem) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
  }, []);

  const handleMobileAdd = async () => {
    const name = mobileNewName.trim();
    if (!name) return;
    const priceNeg = mobileNewPriceNeg.trim() === "" ? 0 : Number(mobileNewPriceNeg);
    const pricePos = mobileNewPricePos.trim() === "" ? 0 : Number(mobileNewPricePos);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast.error("Enter valid prices");
      return;
    }
    const res = await lensStockService.create(scope, { coating: name, priceNeg, pricePos });
    if (res.success && res.data) {
      setItems((prev) => [...prev, res.data!]);
      setSelectedId(res.data!._id);
      setMobileNewName("");
      setMobileNewPriceNeg("");
      setMobileNewPricePos("");
      setMobileAdding(false);
      toast.success("Coating added");
    } else {
      toast.error(res.message || "Failed to add");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <Glasses size={22} className="text-primary-500" />
          </div>
          <div>
            <h2 className="text-feature font-bold text-th-text leading-tight">Lens Stock</h2>
            <p className="text-small text-th-muted">{items.length} coating{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex gap-1 bg-th-elevated rounded-pill p-1">
          {(["shop", "warehouse"] as LensStockScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-4 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
                scope === s
                  ? "bg-primary-500 text-surface-950 shadow-sm"
                  : "text-th-secondary hover:text-th-text"
              }`}
            >
              {s === "shop" ? "Shop" : "Warehouse"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="animate-pulse text-th-muted text-body">Loading...</span>
        </div>
      ) : (
        <>
          {/* Mobile: coating strip */}
          <div className="lg:hidden">
            {mobileAdding ? (
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={mobileNewName}
                    onChange={(e) => setMobileNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleMobileAdd(); if (e.key === "Escape") { setMobileAdding(false); setMobileNewName(""); setMobileNewPriceNeg(""); setMobileNewPricePos(""); } }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                    placeholder="Coating name..."
                  />
                  <button onClick={handleMobileAdd} className="p-2.5 rounded-xl bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
                    <Check size={20} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => { setMobileAdding(false); setMobileNewName(""); setMobileNewPriceNeg(""); setMobileNewPricePos(""); }} className="p-2.5 rounded-xl bg-th-elevated text-th-muted hover:text-th-text transition-colors">
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-small font-bold text-th-muted shrink-0">−₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mobileNewPriceNeg}
                      onChange={(e) => setMobileNewPriceNeg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMobileAdd(); }}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                      placeholder="Neg price"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-small font-bold text-th-muted shrink-0">+₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mobileNewPricePos}
                      onChange={(e) => setMobileNewPricePos(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMobileAdd(); }}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                      placeholder="Pos price"
                    />
                  </div>
                </div>
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
                      className={`shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[96px] rounded-xl border transition-all ${
                        isSelected
                          ? "bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/10"
                          : "border-th-border hover:border-th-border-med bg-th-surface"
                      }`}
                    >
                      <span className={`text-small font-bold truncate w-full text-center ${isSelected ? "text-th-text" : "text-th-secondary"}`}>
                        {item.coating}
                      </span>
                      <span className={`text-small font-medium ${total > 0 ? "text-primary-500" : "text-th-muted"}`}>
                        {total > 0 ? `${total} in stock` : "Empty"}
                      </span>
                      <span className="text-small font-bold text-th-muted">−₹{item.priceNeg ?? 0}/+₹{item.pricePos ?? 0}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => { setMobileAdding(true); setMobileNewName(""); setMobileNewPriceNeg(""); setMobileNewPricePos(""); }}
                  className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[96px] rounded-xl border border-dashed border-th-border hover:border-primary-500/50 bg-th-surface hover:bg-primary-500/5 transition-all"
                >
                  <Plus size={20} className="text-primary-500" />
                  <span className="text-small font-bold text-th-muted">Add</span>
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
                scope={scope}
                onSelect={setSelectedId}
                onAdd={handleAdd}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            </div>

            <div className="flex-1 card p-3 lg:p-4 overflow-hidden flex flex-col min-h-[420px]">
              {selectedItem ? (
                <>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-th-border">
                    <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                    <span className="text-body-bold font-bold text-th-text truncate">{selectedItem.coating}</span>
                    <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-th-secondary text-micro font-bold shrink-0">
                      {getTotalQty(selectedItem)} in stock
                    </span>
                    <span className="text-small-bold text-primary-500 shrink-0">−₹{selectedItem.priceNeg ?? 0}/+₹{selectedItem.pricePos ?? 0}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <LensGrid item={selectedItem} scope={scope} onUpdate={handleGridUpdate} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
                    <Glasses size={24} className="text-th-muted" />
                  </div>
                  <p className="text-th-muted text-body font-bold">Select a coating to update</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
