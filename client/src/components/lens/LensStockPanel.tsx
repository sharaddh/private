import { useEffect, useCallback, useMemo, useState } from "react";
import { lensStockService, shopCartApi, warehouseCartApi } from "../../services";
import { useToast } from "../../context/ToastContext";
import type { LensStockItem, LensStockScope, LensType } from "../../types";
import { TABS, getTotalQty, POWER_VALUES, SPH_INNER, CYL_RANGE, ZERO_KEYS, type TabKey } from "./powers";
import CoatingList from "./CoatingList";
import LensGrid from "./LensGrid";
import { LensCartProvider, useLensCart } from "./LensCartContext";
import LensCartDrawer from "./LensCartDrawer";
import LensDemandGrid, { demandKey, parseDemandKey, getQtyFor } from "./LensDemandGrid";
import LensDemandBar from "./LensDemandBar";
import LensUpdateBar from "./LensUpdateBar";
import LensWithdrawalHistory from "./LensWithdrawalHistory";
import { generateDemandPdf } from "../../utils/demandPdf";
import { Glasses, Plus, Check, X, ClipboardList, History, ShoppingCart, PackagePlus } from "lucide-react";

function priceForPower(item: LensStockItem, powerKey: string): number {
  const sph = String(powerKey || "").split("|")[0];
  const isNeg = sph.startsWith("-") && sph !== "-0.00";
  return isNeg ? item.priceNeg ?? item.price ?? 0 : item.pricePos ?? item.price ?? 0;
}

export default function LensStockPanel({ scope, onScopeChange, staffMode = false }: { scope: LensStockScope; onScopeChange: (s: LensStockScope) => void; staffMode?: boolean }) {
  const cartApi = scope === "shop" ? shopCartApi : warehouseCartApi;

  return (
    <LensCartProvider api={cartApi}>
      <LensStockPanelInner scope={scope} onScopeChange={onScopeChange} staffMode={staffMode} />
    </LensCartProvider>
  );
}

function LensStockPanelInner({ scope, onScopeChange, staffMode }: { scope: LensStockScope; onScopeChange: (s: LensStockScope) => void; staffMode: boolean }) {
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lensType, setLensType] = useState<TabKey>("sph");
  const [loading, setLoading] = useState(true);
  const [mobileAdding, setMobileAdding] = useState(false);
  const [mobileNewName, setMobileNewName] = useState("");
  const [mobileNewPriceNeg, setMobileNewPriceNeg] = useState("");
  const [mobileNewPricePos, setMobileNewPricePos] = useState("");
  const [mode, setMode] = useState<"normal" | "demand" | "update">("normal");
  const [demandTarget, setDemandTarget] = useState(10);
  const [demandSel, setDemandSel] = useState<Map<string, number>>(new Map());
  const [historyOpen, setHistoryOpen] = useState(false);
  const toast = useToast();
  const cart = useLensCart();

  const isShop = scope === "shop";

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

  useEffect(() => {
    if (!isShop) {
      setMode("normal");
    }
  }, [isShop]);

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

  const handleAddToCart = useCallback(async (lensType: LensType, powerKey: string) => {
    if (!selectedItem) return;
    const stockQty = getQtyFor(selectedItem, lensType, powerKey);
    const inCart = cart.items.find(
      (i) => i.coating === selectedItem.coating && i.lensType === lensType && i.powerKey === powerKey
    )?.quantity || 0;
    if (stockQty <= 0) {
      toast.error(`${selectedItem.coating} ${powerKey}: no stock available`);
      return;
    }
    if (inCart >= stockQty) {
      toast.error(`${selectedItem.coating} ${powerKey}: only ${stockQty} in stock`);
      return;
    }
    const ok = await cart.addToCart(selectedItem.coating, lensType, powerKey, 1);
    if (ok) toast.success(`${selectedItem.coating} added to cart`);
    else toast.error("Failed to add to cart");
  }, [selectedItem, cart, toast]);

  const handleRemoveFromCart = useCallback(async (lensType: LensType, powerKey: string) => {
    if (!selectedItem) return;
    const found = cart.items.find(
      (i) => i.coating === selectedItem.coating && i.lensType === lensType && i.powerKey === powerKey
    );
    if (!found) return;
    const ok = await cart.removeItem(found._id);
    if (ok) toast.success(`${selectedItem.coating} ${powerKey} removed from cart`);
    else toast.error("Failed to remove from cart");
  }, [selectedItem, cart, toast]);

  const effectiveLensType: LensType = lensType === "plain" ? "sph" : lensType;

  const cartQtyMap = useMemo(() => {
    if (!selectedItem) return {};
    const map: Record<string, number> = {};
    for (const it of cart.items) {
      if (it.coating === selectedItem.coating && it.lensType === effectiveLensType) {
        map[it.powerKey] = (map[it.powerKey] || 0) + it.quantity;
      }
    }
    return map;
  }, [selectedItem, cart.items, effectiveLensType]);

  const toggleDemand = useCallback((key: string) => {
    setDemandSel((prev) => {
      const next = new Map(prev);
      next.set(key, (next.get(key) || 0) + 1);
      return next;
    });
  }, []);

  const removeDemand = useCallback((key: string) => {
    setDemandSel((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearDemand = useCallback(() => setDemandSel(new Map()), []);

  const selectAllLowStock = useCallback(() => {
    const next = new Map<string, number>();
    for (const item of items) {
      const addIfLow = (lensType: LensType, key: string) => {
        const qty = getQtyFor(item, lensType, key);
        if (qty < demandTarget) next.set(demandKey(item.coating, lensType, key), demandTarget - qty);
      };
      addIfLow("sph", "+0.00");
      for (const key of POWER_VALUES) {
        if (ZERO_KEYS.includes(key)) continue;
        addIfLow("sph", key);
        addIfLow("cyl", key);
      }
      for (const sph of SPH_INNER) {
        for (const cyl of CYL_RANGE) {
          addIfLow("compound", `${sph}|${cyl}`);
        }
      }
    }
    setDemandSel(next);
    toast.success(`Selected all lens powers below ${demandTarget}`);
  }, [items, demandTarget, toast]);

  const demandRows = useMemo(() => {
    const rows: { coating: string; lensType: string; powerKey: string; current: number; target: number; qty: number; price: number }[] = [];
    for (const [key, qty] of demandSel) {
      const parsed = parseDemandKey(key);
      if (!parsed) continue;
      const item = items.find((i) => i.coating === parsed!.coating);
      if (!item) continue;
      const current = getQtyFor(item, parsed.lensType, parsed.powerKey);
      rows.push({
        coating: item.coating,
        lensType: parsed.lensType,
        powerKey: parsed.powerKey,
        current,
        target: demandTarget,
        qty,
        price: priceForPower(item, parsed.powerKey),
      });
    }
    return rows.sort(
      (a, b) => a.coating.localeCompare(b.coating) || a.lensType.localeCompare(b.lensType) || a.powerKey.localeCompare(b.powerKey)
    );
  }, [demandSel, items, demandTarget]);

  const totalNeed = demandRows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = demandRows.reduce((s, r) => s + r.qty * r.price, 0);

  const handleDownloadDemand = () => {
    if (demandRows.length === 0) {
      toast.error("Select at least one lens to generate demand");
      return;
    }
    generateDemandPdf({ target: demandTarget, generatedAt: new Date().toISOString(), items: demandRows });
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
        <div className="flex items-center gap-2 flex-wrap">
          {isShop && !staffMode && (
            <>
              <button type="button"
                onClick={() => setMode((m) => (m === "update" ? "normal" : "update"))}
                className={`flex items-center gap-2 px-3 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
                  mode === "update"
                    ? "bg-primary-500 text-surface-950 shadow-sm"
                    : "bg-th-elevated text-th-secondary border border-th-border hover:text-th-text"
                }`}
                aria-label="Update Stock"
              >
                <PackagePlus size={18} />
                <span className="hidden sm:inline">Update Stock</span>
              </button>
              <button type="button"
                onClick={() => setMode((m) => (m === "demand" ? "normal" : "demand"))}
                className={`flex items-center gap-2 px-3 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
                  mode === "demand"
                    ? "bg-primary-500 text-surface-950 shadow-sm"
                    : "bg-th-elevated text-th-secondary border border-th-border hover:text-th-text"
                }`}
                aria-label="Stock Demand"
              >
                <ClipboardList size={18} />
                <span className="hidden sm:inline">Stock Demand</span>
              </button>
            </>
          )}
          <button type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-pill text-small-bold transition-all active:scale-95 bg-th-elevated text-th-secondary border border-th-border hover:text-th-text"
            aria-label="Withdrawal history"
          >
            <History size={18} />
            <span className="hidden sm:inline">History</span>
          </button>
          <button type="button"
            onClick={() => cart.setOpen(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-pill text-small-bold transition-all active:scale-95 bg-th-elevated text-th-secondary border border-th-border hover:text-th-text"
            aria-label="Open cart"
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Cart</span>
            {cart.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-surface-950 text-micro font-bold flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </button>
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
                  <button type="button" onClick={handleMobileAdd} className="p-2.5 rounded-xl bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors">
                    <Check size={20} strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => { setMobileAdding(false); setMobileNewName(""); setMobileNewPriceNeg(""); setMobileNewPricePos(""); }} className="p-2.5 rounded-xl bg-th-elevated text-th-muted hover:text-th-text transition-colors">
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
                    <button type="button"
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
                {isShop && !staffMode && (
                  <button type="button"
                    onClick={() => { setMobileAdding(true); setMobileNewName(""); setMobileNewPriceNeg(""); setMobileNewPricePos(""); }}
                    className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[96px] rounded-xl border border-dashed border-th-border hover:border-primary-500/50 bg-th-surface hover:bg-primary-500/5 transition-all"
                  >
                    <Plus size={20} className="text-primary-500" />
                    <span className="text-small font-bold text-th-muted">Add</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop: sidebar + content */}
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="hidden lg:flex w-64 shrink-0 card p-3 flex-col overflow-hidden">
              <CoatingList
                items={items}
                selectedId={selectedId}
                scope={scope}
                readonly={!isShop || staffMode}
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
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
                      {TABS.map((t) => (
                        <button type="button"
                          key={t.key}
                          onClick={() => setLensType(t.key)}
                          className={`flex-1 px-2 py-2.5 rounded-pill text-small-bold transition-all active:scale-95 ${
                            lensType === t.key
                              ? "bg-primary-500 text-surface-950 shadow-sm"
                              : "text-th-secondary active:bg-th-hover"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {mode === "demand" ? (
                      <LensDemandGrid
                        item={selectedItem}
                        lensType={lensType}
                        demandTarget={demandTarget}
                        demandSel={demandSel}
                        onToggleDemand={toggleDemand}
                        onRemoveDemand={removeDemand}
                      />
                    ) : (
                      <LensGrid
                        item={selectedItem}
                        scope={scope}
                        lensType={lensType}
                        onUpdate={mode === "update" ? handleGridUpdate : undefined}
                        onAddToCart={mode === "update" ? undefined : handleAddToCart}
                        onRemoveFromCart={mode === "update" ? undefined : handleRemoveFromCart}
                        clickTitle={mode === "update" ? undefined : "Add to cart"}
                        cartQty={mode === "update" ? undefined : cartQtyMap}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
                    <Glasses size={24} className="text-th-muted" />
                  </div>
                  <p className="text-th-muted text-body font-bold">Select a coating to view</p>
                </div>
              )}
            </div>
          </div>

          {mode === "demand" && isShop && !staffMode && (
            <LensDemandBar
              demandSelSize={demandSel.size}
              totalNeed={totalNeed}
              totalAmount={totalAmount}
              target={demandTarget}
              onSetTarget={setDemandTarget}
              onAllLowStock={selectAllLowStock}
              onClear={clearDemand}
              onDownload={handleDownloadDemand}
            />
          )}
          {mode === "update" && isShop && !staffMode && (
            <LensUpdateBar onDone={() => setMode("normal")} />
          )}
        </>
      )}

      <LensCartDrawer onWithdrawn={fetchItems} />
      <LensWithdrawalHistory open={historyOpen} onClose={() => setHistoryOpen(false)} onUpdated={fetchItems} />
    </div>
  );
}
