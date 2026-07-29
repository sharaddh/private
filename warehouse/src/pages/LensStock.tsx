import { useState, useEffect, useCallback, useMemo, memo } from "react";
import type { LensStockItem, LensType } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import { useCart } from "../context/CartContext";
import { flyToCart } from "../utils/flyToCart";
import { Glasses, ChevronDown, ChevronRight, X, Plus, Check } from "lucide-react";
import { POWER_VALUES } from "../constants";

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

const TABS: { key: LensType; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "compound", label: "Both" },
];

const LensCard = memo(function LensCard({ coating: _coating, lensType: _lensType, powerKey, qty, inCart, cartQty: _cartQty, atMax, onAdd, onRemove }: {
  coating: string;
  lensType: LensType;
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const isNeg = powerKey.startsWith("-");
  const isPos = powerKey.startsWith("+") && powerKey !== "+0.00";

  const baseBorder = isNeg
    ? "border-amber-400/40 bg-amber-400/10"
    : isPos
    ? "border-emerald-400/40 bg-emerald-400/10"
    : "border-th-border bg-th-elevated";

  const selectedBorder = inCart
    ? atMax
      ? "border-warning/70 bg-warning/10 ring-1 ring-warning/20"
      : "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
    : baseBorder;

  return (
    <div
      data-lens-card
      className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-md border transition-all duration-150 ${selectedBorder} ${inCart && !atMax ? "animate-selected-pulse" : ""} ${atMax ? "opacity-60" : ""}`}
    >
      {inCart && (
        <span
          role="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={10} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-1 w-full disabled:cursor-not-allowed"
      >
        <span className="text-micro font-bold text-th-secondary leading-none">{powerKey}</span>
        <span className={`text-body-bold leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
      </button>
    </div>
  );
});

const CompoundLensCard = memo(function CompoundLensCard({ coating: _coating, powerKey, qty, inCart, cartQty: _cartQty, atMax, onAdd, onRemove }: {
  coating: string;
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const cyl = powerKey.split("|")[1];
  const isNeg = cyl.startsWith("-");
  const isPos = cyl.startsWith("+") && cyl !== "+0.00";

  const baseBorder = isNeg
    ? "border-amber-400/40 bg-amber-400/5"
    : isPos
    ? "border-emerald-400/40 bg-emerald-400/5"
    : "border-th-border bg-th-elevated";

  const selectedBorder = inCart
    ? atMax
      ? "border-warning/70 bg-warning/10 ring-1 ring-warning/20"
      : "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
    : baseBorder;

  return (
    <div
      data-lens-card
      className={`relative flex flex-col items-center gap-1 py-2 px-1.5 rounded-md border transition-all duration-150 ${selectedBorder} ${inCart && !atMax ? "animate-selected-pulse" : ""} ${atMax ? "opacity-60" : ""}`}
    >
      {inCart && (
        <span
          role="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={10} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-1 w-full disabled:cursor-not-allowed"
      >
        <span className="text-micro font-bold text-th-secondary leading-none">{cyl === "+0.00" ? "0.00" : cyl}</span>
        <span className={`text-body-bold leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
      </button>
    </div>
  );
});

interface FlatGridProps {
  quantities: Record<string, number>;
  coating: string;
  lensType: LensType;
  addToCart: (coating: string, lensType: string, powerKey: string) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

const FlatGrid = memo(function FlatGrid({ quantities, coating, lensType, addToCart, isInCart, getItemQty, removeByDetails }: FlatGridProps) {
  const [openGroup, setOpenGroup] = useState<string>("Negative");
  const allEntries = useMemo(() => Object.entries(quantities).filter(([, q]) => q > 0), [quantities]);

  const negatives = useMemo(() => allEntries.filter(([p]) => p.startsWith("-")).sort((a, b) => b[0].localeCompare(a[0])), [allEntries]);
  const positives = useMemo(() => allEntries.filter(([p]) => p.startsWith("+") && p !== "+0.00").sort((a, b) => a[0].localeCompare(b[0])), [allEntries]);
  const zeros = useMemo(() => allEntries.filter(([p]) => p === "+0.00" || p === "0.00" || p === "-0.00"), [allEntries]);

  if (allEntries.length === 0) {
    return <p className="text-center text-th-muted text-body py-12">No stock for this lens type</p>;
  }

  function toggle(label: string) {
    setOpenGroup((prev) => (prev === label ? "" : label));
  }

  const groups: { label: string; entries: [string, number][]; color: string }[] = [
    { label: "Negative", entries: negatives, color: "text-amber-500" },
    { label: "Zero", entries: zeros, color: "text-th-muted" },
    { label: "Positive", entries: positives, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        if (group.entries.length === 0) return null;
        const isOpen = openGroup === group.label;
        return (
          <div key={group.label}>
            <button
              onClick={() => toggle(group.label)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors"
            >
              {isOpen ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
              <span className={`text-xs font-bold uppercase tracking-wider ${group.color}`}>{group.label}</span>
              <span className="text-xs text-th-muted font-medium">({group.entries.length})</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-2 pl-5">
                {group.entries.map(([power, qty]) => {
                  const stockQty = qty;
                  const currentCartQty = getItemQty(coating, lensType, power);
                  const atMax = stockQty > 0 && currentCartQty >= stockQty;
                  return (
                    <LensCard
                      key={power}
                      coating={coating}
                      lensType={lensType}
                      powerKey={power}
                      qty={qty}
                      inCart={isInCart(coating, lensType, power)}
                      cartQty={currentCartQty}
                      atMax={atMax}
                      onAdd={(e) => {
                        const stockQty = quantities[power] || 0;
                        const currentCartQty = getItemQty(coating, lensType, power);
                        if (stockQty > 0 && currentCartQty >= stockQty) return;
                        addToCart(coating, lensType, power);
                        flyToCart(e.currentTarget);
                      }}
                      onRemove={() => removeByDetails(coating, lensType, power)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

interface CompoundViewProps {
  quantities: Record<string, number>;
  coating: string;
  addToCart: (coating: string, lensType: string, powerKey: string) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

const SPH_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -4 && n <= 4;
});
const negSphList = SPH_RANGE.filter((p) => p.startsWith("-")).reverse();
const zeroSphList = SPH_RANGE.filter((p) => p === "+0.00" || p === "0.00" || p === "-0.00");
const posSphList = SPH_RANGE.filter((p) => p.startsWith("+") && p !== "+0.00");

const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});

const CompoundView = memo(function CompoundView({ quantities, coating, addToCart, isInCart, getItemQty, removeByDetails }: CompoundViewProps) {
  const [openSph, setOpenSph] = useState<string>("");

  const sphGroups: { label: string; values: string[]; color: string }[] = [
    { label: "Negative SPH", values: negSphList, color: "text-amber-500" },
    { label: "Zero", values: zeroSphList, color: "text-th-muted" },
    { label: "Positive SPH", values: posSphList, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-2">
      {sphGroups.map((group) => {
        if (group.values.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="text-micro font-bold uppercase tracking-wider mb-1.5 px-1">{group.label}</div>
            <div className="space-y-1">
              {group.values.map((sph) => {
                const isOpen = openSph === sph;
                const sphNeg = sph.startsWith("-");
                const sphColor = sphNeg ? "text-amber-500" : sph === "+0.00" ? "text-th-muted" : "text-emerald-500";
                const sphBg = sphNeg ? "bg-amber-500/10" : sph === "+0.00" ? "bg-th-elevated" : "bg-emerald-500/10";

                let cylStockCount = 0;
                for (const cyl of CYL_RANGE) {
                  if ((quantities[`${sph}|${cyl}`] || 0) > 0) cylStockCount++;
                }

                return (
                  <div key={sph}>
                    <button
                      onClick={() => setOpenSph((prev) => (prev === sph ? "" : sph))}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${sphBg} ${sphColor} text-micro font-bold`}>
                        SPH {sph}
                      </span>
                      <span className="text-micro text-primary-500 font-medium">{cylStockCount} in stock</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-5 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                        {CYL_RANGE.map((cyl) => {
                          const key = `${sph}|${cyl}`;
                          const qty = quantities[key] || 0;
                          const inCart = isInCart(coating, "compound", key);
                          const cartQty = getItemQty(coating, "compound", key);
                          const atMax = qty <= 0 || cartQty >= qty;
                          return (
                            <CompoundLensCard
                              key={key}
                              coating={coating}
                              powerKey={key}
                              qty={qty}
                              inCart={inCart}
                              cartQty={cartQty}
                              atMax={atMax}
                              onAdd={(e) => {
                                const stockQty = quantities[key] || 0;
                                const currentCartQty = getItemQty(coating, "compound", key);
                                if (stockQty <= 0 || currentCartQty >= stockQty) return;
                                addToCart(coating, "compound", key);
                                flyToCart(e.currentTarget);
                              }}
                              onRemove={() => removeByDetails(coating, "compound", key)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default function LensStock() {
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lensType, setLensType] = useState<LensType>("sph");
  const [loading, setLoading] = useState(true);
  const [mobileAdding, setMobileAdding] = useState(false);
  const [mobileNewName, setMobileNewName] = useState("");
  const { toast } = useToast();
  const { addToCart, isInCart, getItemQty, removeByDetails } = useCart();

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const res = await api.get<LensStockItem[]>("/api/warehouse/lens-stock");
      if (res.success && res.data) {
        setItems(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0]._id);
      } else {
        toast(res.message || "Failed to load lens stock", "error");
      }
      setLoading(false);
    }
    fetchItems();
  }, []);

  const selectedItem = useMemo(() => items.find((i) => i._id === selectedId) || null, [items, selectedId]);
  const quantities = useMemo(() => (selectedItem?.quantities?.[lensType] || {}) as Record<string, number>, [selectedItem, lensType]);

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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-th-muted text-body">Loading...</span></div>;
  }

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center">
          <Glasses size={18} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-feature font-bold text-th-text leading-tight">Lens Stock</h1>
          <p className="text-micro text-th-muted">{items.length} coating{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Mobile: coating select + lens type tabs */}
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
          <div className="flex items-center gap-2">
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-th-surface border border-th-border text-sm font-bold text-th-text appearance-none cursor-pointer"
            >
              {items.map((item) => {
                const total = getTotalQty(item);
                return (
                  <option key={item._id} value={item._id}>
                    {item.coating} ({total})
                  </option>
                );
              })}
            </select>
            <button
              onClick={() => { setMobileAdding(true); setMobileNewName(""); }}
              className="p-2 rounded-xl border border-dashed border-th-border hover:border-primary-500/50 bg-th-surface hover:bg-primary-500/5 transition-all"
            >
              <Plus size={18} className="text-primary-500" />
            </button>
            <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLensType(t.key)}
                  className={`px-2.5 py-1.5 rounded-pill text-micro font-bold transition-all ${
                    lensType === t.key
                      ? "bg-primary-500 text-surface-950 shadow-sm"
                      : "text-th-secondary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-56 shrink-0 card p-4 flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-th-text uppercase tracking-wider mb-4">Coatings</h3>
          <div className="flex-1 overflow-auto scrollbar-thin space-y-1.5">
            {items.map((item) => {
              const total = getTotalQty(item);
              const isSelected = item._id === selectedId;
              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-primary-500/10 border border-primary-500/30 shadow-sm ring-1 ring-primary-500/10"
                      : "hover:bg-th-elevated border border-transparent hover:border-th-border"
                  }`}
                >
                  <div className={`w-1 h-10 rounded-sm flex-shrink-0 transition-colors ${isSelected ? "bg-primary-500" : "bg-th-border"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isSelected ? "text-th-text" : "text-th-secondary"}`}>
                      {item.coating}
                    </div>
                    <div className={`text-xs mt-0.5 font-medium ${total > 0 ? "text-primary-500" : "text-th-muted"}`}>
                      {total > 0 ? `${total} in stock` : "Empty"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 card p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-th-border">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-sm lg:text-body-bold font-bold text-th-text truncate">{selectedItem.coating}</span>
                <div className="ml-auto hidden lg:flex gap-1 bg-th-elevated rounded-pill p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setLensType(t.key)}
                      className={`px-3 py-1 rounded-pill text-micro font-bold transition-all ${
                        lensType === t.key
                          ? "bg-primary-500 text-surface-950 shadow-sm"
                          : "text-th-secondary hover:text-th-text"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {lensType === "compound" ? (
                  <CompoundView
                    quantities={quantities}
                    coating={selectedItem.coating}
                    addToCart={addToCart}
                    isInCart={isInCart}
                    getItemQty={getItemQty}
                    removeByDetails={removeByDetails}
                  />
                ) : (
                  <FlatGrid
                    quantities={quantities}
                    coating={selectedItem.coating}
                    lensType={lensType}
                    addToCart={addToCart}
                    isInCart={isInCart}
                    getItemQty={getItemQty}
                    removeByDetails={removeByDetails}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-th-muted text-body">Select a coating to view stock</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
