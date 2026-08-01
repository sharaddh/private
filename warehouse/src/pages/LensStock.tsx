import { useState, useEffect, useMemo, memo } from "react";
import type { LensStockItem, LensType } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import { useCart } from "../context/CartContext";
import { flyToCart } from "../utils/flyToCart";
import { Glasses, ChevronDown, ChevronRight, X } from "lucide-react";
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
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={12} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-1 w-full disabled:cursor-not-allowed"
      >
        <span className="text-small-bold text-th-secondary leading-none">{powerKey}</span>
        <span className={`text-body-bold leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
      </button>
    </div>
  );
});

const CompoundLensCard = memo(function CompoundLensCard({ coating, powerKey, qty, inCart, cartQty: _cartQty, atMax, onAdd, onRemove }: {
  coating: string;
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const sph = powerKey.split("|")[0];
  const cyl = powerKey.split("|")[1] || "";
  const sphLabel = sph === "+0.00" || sph === "0.00" || sph === "-0.00" ? "0.00" : sph;
  const cylLabel = cyl === "+0.00" || cyl === "0.00" || cyl === "-0.00" ? "0.00" : cyl;
  const sphNeg = sph.startsWith("-");
  const sphPos = sph.startsWith("+") && sph !== "+0.00";
  const cylNeg = cyl.startsWith("-");
  const cylPos = cyl.startsWith("+") && cyl !== "+0.00";

  const baseBorder = sphNeg
    ? "border-amber-400/40 bg-amber-400/5"
    : sphPos
    ? "border-emerald-400/40 bg-emerald-400/5"
    : "border-th-border bg-th-elevated";

  const selectedBorder = inCart
    ? atMax
      ? "border-warning/70 bg-warning/10 ring-1 ring-warning/20"
      : "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
    : baseBorder;

  const coatingShort = coating.length > 12 ? coating.slice(0, 11) + "…" : coating;

  return (
    <div
      data-lens-card
      className={`relative flex flex-col items-center gap-1 py-2 px-1.5 rounded-md border transition-all duration-150 ${selectedBorder} ${inCart && !atMax ? "animate-selected-pulse" : ""} ${atMax ? "opacity-60" : ""}`}
    >
      {inCart && (
        <span
          role="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={12} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-0.5 w-full disabled:cursor-not-allowed"
      >
        <span className="text-micro text-th-muted leading-none truncate w-full text-center" title={coating}>{coatingShort}</span>
        <span className={`text-small-bold leading-none ${sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-secondary"}`}>SPH {sphLabel}</span>
        <span className={`text-micro leading-none ${cylNeg ? "text-amber-500" : cylPos ? "text-emerald-500" : "text-th-muted"}`}>CYL {cylLabel}</span>
        <span className={`text-body-bold leading-none ${sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
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
              <span className={`text-small font-bold uppercase tracking-wider ${group.color}`}>{group.label}</span>
              <span className="text-small text-th-muted font-medium">({group.entries.length})</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-2 pl-5 pr-1">
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

const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});
const negCylList = CYL_RANGE.filter((p) => p.startsWith("-")).reverse();
const zeroCylList = CYL_RANGE.filter((p) => p === "+0.00" || p === "0.00" || p === "-0.00");
const posCylList = CYL_RANGE.filter((p) => p.startsWith("+") && p !== "+0.00");

const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -4 && n <= -0.25) || (n >= 0.25 && n <= 4);
});
const negSphInner = SPH_INNER.filter((p) => p.startsWith("-")).reverse();
const posSphInner = SPH_INNER.filter((p) => p.startsWith("+") && p !== "+0.00");

const CompoundView = memo(function CompoundView({ quantities, coating, addToCart, isInCart, getItemQty, removeByDetails }: CompoundViewProps) {
  const [openCyl, setOpenCyl] = useState<string>("");

  const cylGroups: { label: string; values: string[]; color: string }[] = [
    { label: "Negative CYL", values: negCylList, color: "text-amber-500" },
    { label: "Zero", values: zeroCylList, color: "text-th-muted" },
    { label: "Positive CYL", values: posCylList, color: "text-emerald-500" },
  ];

  const sphInnerGroups: { label: string; values: string[]; color: string }[] = [
    { label: "Negative SPH", values: negSphInner, color: "text-amber-500" },
    { label: "Positive SPH", values: posSphInner, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-2">
      {cylGroups.map((group) => {
        if (group.values.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="text-small font-bold uppercase tracking-wider mb-1.5 px-1">{group.label}</div>
            <div className="space-y-1">
              {group.values.map((cyl) => {
                const isOpen = openCyl === cyl;
                const cylNeg = cyl.startsWith("-");
                const cylColor = cylNeg ? "text-amber-500" : cyl === "+0.00" ? "text-th-muted" : "text-emerald-500";
                const cylBg = cylNeg ? "bg-amber-500/10" : cyl === "+0.00" ? "bg-th-elevated" : "bg-emerald-500/10";

                let sphStockCount = 0;
                for (const sph of SPH_INNER) {
                  if ((quantities[`${sph}|${cyl}`] || 0) > 0) sphStockCount++;
                }

                return (
                  <div key={cyl}>
                    <button
                      onClick={() => setOpenCyl((prev) => (prev === cyl ? "" : cyl))}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylColor} text-small-bold`}>
                        CYL {cyl}
                      </span>
                      <span className="text-small text-primary-500 font-medium">{sphStockCount} in stock</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-5 space-y-3">
                        {sphInnerGroups.map((sphGroup) => (
                          <div key={sphGroup.label}>
                            <div className="text-small font-bold uppercase tracking-wider mb-1.5 px-1 text-th-muted">{sphGroup.label}</div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 pr-1">
                              {sphGroup.values.map((sph) => {
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
                          </div>
                        ))}
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-th-muted text-body">Loading...</span></div>;
  }

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
          <Glasses size={22} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-feature font-bold text-th-text leading-tight">Lens Stock</h1>
          <p className="text-small text-th-muted">{items.length} coating{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Mobile: coating select + lens type tabs */}
      <div className="lg:hidden space-y-2.5">
        <select
          value={selectedId || ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-th-surface border border-th-border text-small font-bold text-th-text appearance-none cursor-pointer"
        >
          {items.map((item) => {
            const total = getTotalQty(item);
            return (
              <option key={item._id} value={item._id}>
                {item.coating} ({total}) · ₹{item.price ?? 0}
              </option>
            );
          })}
        </select>
        <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setLensType(t.key)}
              className={`px-3 py-2 rounded-pill text-small font-bold transition-all ${
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

      {/* Desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-56 shrink-0 card p-4 flex-col overflow-hidden">
          <h3 className="text-small font-bold text-th-text uppercase tracking-wider mb-4">Coatings</h3>
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
                    <div className={`text-small-bold truncate ${isSelected ? "text-th-text" : "text-th-secondary"}`}>
                      {item.coating}
                    </div>
                    <div className={`text-small mt-0.5 font-medium ${total > 0 ? "text-primary-500" : "text-th-muted"}`}>
                      {total > 0 ? `${total} in stock` : "Empty"}
                    </div>
                    <div className="text-small mt-0.5 font-bold text-th-muted">₹{item.price ?? 0}</div>
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
                <span className="text-body-bold font-bold text-th-text truncate">{selectedItem.coating}</span>
                <span className="text-small-bold text-primary-500 shrink-0">₹{selectedItem.price ?? 0}</span>
                <div className="ml-auto hidden lg:flex gap-1 bg-th-elevated rounded-pill p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setLensType(t.key)}
                      className={`px-3 py-1.5 rounded-pill text-small font-bold transition-all ${
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
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
                <Glasses size={24} className="text-th-muted" />
              </div>
              <p className="text-th-muted text-body font-bold">Select a coating to view stock</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
