import { useState, useEffect } from "react";
import type { LensStockItem, LensType } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import { useCart } from "../context/CartContext";
import { flyToCart } from "../utils/flyToCart";
import { Glasses, ChevronDown, ChevronRight, X } from "lucide-react";

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

function generatePowerValues(): string[] {
  const values: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const num = i * 0.25;
    const formatted = num.toFixed(2);
    values.push(`+${formatted}`);
    if (num > 0) values.unshift(`-${formatted}`);
  }
  return values;
}

const POWER_VALUES = generatePowerValues();

interface LensCardProps {
  coating: string;
  lensType: LensType;
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
}

function LensCard({ coating, lensType, powerKey, qty, inCart, cartQty, atMax, onAdd, onRemove }: LensCardProps) {
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
      className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-md border transition-all duration-200 ${selectedBorder} ${inCart && !atMax ? "animate-selected-pulse" : ""} ${atMax ? "opacity-60" : ""}`}
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
}

function CompoundLensCard({ coating, powerKey, qty, inCart, cartQty, atMax, onAdd, onRemove }: { coating: string; powerKey: string; qty: number; inCart: boolean; cartQty: number; atMax: boolean; onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void; onRemove: (e: React.MouseEvent) => void }) {
  const sph = powerKey.split("|")[0];
  const isNeg = sph.startsWith("-");
  const isPos = sph.startsWith("+") && sph !== "+0.00";

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
      className={`relative flex flex-col items-center gap-1 py-2 px-1.5 rounded-md border transition-all duration-200 ${selectedBorder} ${inCart && !atMax ? "animate-selected-pulse" : ""} ${atMax ? "opacity-60" : ""}`}
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
        <span className="text-micro font-bold text-th-secondary leading-none">{sph === "+0.00" ? "0.00" : sph}</span>
        <span className={`text-body-bold leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
      </button>
    </div>
  );
}

interface FlatGridProps {
  quantities: Record<string, number>;
  coating: string;
  lensType: LensType;
  addToCart: (coating: string, lensType: string, powerKey: string) => boolean;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

function FlatGrid({ quantities, coating, lensType, addToCart, isInCart, getItemQty, removeByDetails }: FlatGridProps) {
  const [openGroup, setOpenGroup] = useState<string>("Negative");
  const allEntries = Object.entries(quantities).filter(([, q]) => q > 0);

  const negatives = allEntries.filter(([p]) => p.startsWith("-")).sort((a, b) => b[0].localeCompare(a[0]));
  const positives = allEntries.filter(([p]) => p.startsWith("+") && p !== "+0.00").sort((a, b) => a[0].localeCompare(b[0]));
  const zeros = allEntries.filter(([p]) => p === "+0.00" || p === "0.00" || p === "-0.00");

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

  function handleAdd(power: string, e: React.MouseEvent<HTMLButtonElement>) {
    const stockQty = quantities[power] || 0;
    const currentCartQty = getItemQty(coating, lensType, power);
    if (stockQty > 0 && currentCartQty >= stockQty) return;
    addToCart(coating, lensType, power);
    flyToCart(e.currentTarget);
  }

  function handleRemove(power: string) {
    removeByDetails(coating, lensType, power);
  }

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
                      onAdd={(e) => handleAdd(power, e)}
                      onRemove={() => handleRemove(power)}
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
}

interface CompoundViewProps {
  quantities: Record<string, number>;
  coating: string;
  addToCart: (coating: string, lensType: string, powerKey: string) => boolean;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

function CompoundView({ quantities, coating, addToCart, isInCart, getItemQty, removeByDetails }: CompoundViewProps) {
  const [openCyl, setOpenCyl] = useState<string>("");
  const hasAny = Object.values(quantities).some((q) => q > 0);

  if (!hasAny) {
    return <p className="text-center text-th-muted text-body py-12">No stock for this lens type</p>;
  }

  function renderSphSection(sphValues: string[], filter: "neg" | "pos" | "zero") {
    const filtered = sphValues.filter((sph) => {
      const qty = quantities[`${sph}|${openCyl}`] || 0;
      if (qty <= 0) return false;
      if (filter === "neg") return sph.startsWith("-");
      if (filter === "zero") return sph === "+0.00" || sph === "0.00" || sph === "-0.00";
      return sph.startsWith("+") && sph !== "+0.00";
    });

    if (filtered.length === 0) return null;

    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
        {filtered.map((sph) => {
          const key = `${sph}|${openCyl}`;
          const qty = quantities[key] || 0;
          const inCart = isInCart(coating, "compound", key);
          const cartQty = getItemQty(coating, "compound", key);
          const atMax = qty > 0 && cartQty >= qty;
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
                if (stockQty > 0 && currentCartQty >= stockQty) return;
                addToCart(coating, "compound", key);
                flyToCart(e.currentTarget);
              }}
              onRemove={() => {
                removeByDetails(coating, "compound", key);
              }}
            />
          );
        })}
      </div>
    );
  }

  const negSph = POWER_VALUES.filter((p) => p.startsWith("-")).reverse();
  const posSph = POWER_VALUES.filter((p) => p.startsWith("+") && p !== "+0.00");
  const hasZero = POWER_VALUES.some((p) => p === "+0.00" || p === "0.00");

  return (
    <div className="space-y-2">
      {POWER_VALUES.map((cyl) => {
        const cylNeg = cyl.startsWith("-");
        const cylLabel = cylNeg ? "text-amber-500" : cyl === "+0.00" ? "text-th-muted" : "text-emerald-500";
        const cylBg = cylNeg ? "bg-amber-500/10" : cyl === "+0.00" ? "bg-th-elevated" : "bg-emerald-500/10";
        const isOpen = openCyl === cyl;

        let stockCount = 0;
        for (const sph of POWER_VALUES) {
          if ((quantities[`${sph}|${cyl}`] || 0) > 0) stockCount++;
        }

        return (
          <div key={cyl}>
            <button
              onClick={() => setOpenCyl((prev) => (prev === cyl ? "" : cyl))}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors"
            >
              {isOpen ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
              <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylLabel} text-micro font-bold`}>
                CYL {cyl}
              </span>
              {stockCount > 0 && (
                <span className="text-micro text-primary-500 font-medium">{stockCount} in stock</span>
              )}
            </button>
            {isOpen && (
              <div className="mt-2 ml-5 space-y-3">
                {renderSphSection(negSph, "neg") && (
                  <div>
                    <div className="text-micro font-bold text-amber-500 uppercase tracking-wider mb-1.5">Negative SPH</div>
                    {renderSphSection(negSph, "neg")}
                  </div>
                )}
                {hasZero && renderSphSection(POWER_VALUES, "zero") && (
                  <div>
                    <div className="text-micro font-bold text-th-muted uppercase tracking-wider mb-1.5">Zero</div>
                    {renderSphSection(POWER_VALUES, "zero")}
                  </div>
                )}
                {renderSphSection(posSph, "pos") && (
                  <div>
                    <div className="text-micro font-bold text-emerald-500 uppercase tracking-wider mb-1.5">Positive SPH</div>
                    {renderSphSection(posSph, "pos")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

  const selectedItem = items.find((i) => i._id === selectedId) || null;
  const quantities = (selectedItem?.quantities?.[lensType] || {}) as Record<string, number>;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-th-muted text-body">Loading...</span></div>;
  }

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0">
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
      <div className="lg:hidden flex items-center gap-2">
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
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
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
