import { useState, useEffect, useMemo, memo } from "react";
import type { LensStockItem, LensType } from "../types/lensStock";
import { priceForPower } from "../types/lensStock";
import api from "../api";
import { useToast } from "../context";
import { useCart } from "../context/CartContext";
import { flyToCart } from "../utils/flyToCart";
import { generateDemandPdf } from "../utils/demandPdf";
import { Glasses, ChevronDown, ChevronRight, X, Download, ClipboardList, Minus, Plus } from "lucide-react";
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

const ZERO_KEYS = ["+0.00", "0.00", "-0.00"];

function demandKey(coating: string, lensType: string, powerKey: string): string {
  return `${coating}::${lensType}::${powerKey}`;
}

function parseDemandKey(key: string): { coating: string; lensType: string; powerKey: string } | null {
  const [coating, lensType, powerKey] = key.split("::");
  if (!coating || !lensType || powerKey === undefined) return null;
  return { coating, lensType, powerKey };
}

function getQtyFor(item: LensStockItem, lensType: string, powerKey: string): number {
  if (lensType === "sph" && ZERO_KEYS.includes(powerKey)) {
    return ZERO_KEYS.reduce((sum, k) => sum + (item.quantities?.sph?.[k] || 0), 0);
  }
  const map = item.quantities?.[lensType as LensType];
  return map?.[powerKey] || 0;
}

type TabKey = LensType | "plain";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "compound", label: "Compound" },
  { key: "plain", label: "Plain" },
];

const LensCard = memo(function LensCard({ coating: _coating, lensType: _lensType, powerKey, qty, inCart, cartQty: _cartQty, atMax, onAdd, onRemove, demandMode = false, demandQty = 0, need = 0, onToggleDemand, onRemoveDemand }: {
  coating: string;
  lensType: LensType;
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
  demandMode?: boolean;
  demandQty?: number;
  need?: number;
  onToggleDemand?: () => void;
  onRemoveDemand?: () => void;
}) {
  const isNeg = powerKey.startsWith("-");
  const isPos = powerKey.startsWith("+") && powerKey !== "+0.00";
  const isZero = powerKey === "+0.00" || powerKey === "0.00" || powerKey === "-0.00";
  const powerLabel = isZero ? "0.00" : powerKey;

  const baseBorder = isNeg
    ? "border-amber-400/40 bg-amber-400/10"
    : isPos
    ? "border-emerald-400/40 bg-emerald-400/10"
    : "border-th-border bg-th-elevated";

  const selectedBorder = demandMode
    ? demandQty > 0
      ? "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
      : baseBorder
    : inCart
    ? atMax
      ? "border-warning/70 bg-warning/10 ring-1 ring-warning/20"
      : "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
    : baseBorder;

  return (
    <div
      data-lens-card
      onClick={demandMode ? () => onToggleDemand && onToggleDemand() : undefined}
      className={`relative flex flex-col items-center gap-1.5 py-4 px-3 rounded-lg border transition-all duration-150 ${selectedBorder} ${demandMode ? "cursor-pointer" : ""} ${inCart && !atMax && !demandMode ? "animate-selected-pulse" : ""} ${atMax && !demandMode ? "opacity-60" : ""}`}
    >
      {demandMode ? (
        demandQty > 0 && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onRemoveDemand && onRemoveDemand(); }}
            className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center cursor-pointer active:scale-90 z-10"
            title="Remove from demand"
          >
            <span className="text-micro font-bold leading-none">{demandQty}</span>
          </span>
        )
      ) : (
        inCart && (
          <span
            role="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
          >
            <X size={13} className="text-white" strokeWidth={3} />
          </span>
        )
      )}
      {demandMode ? (
        <div className="flex flex-col items-center gap-1.5 w-full pointer-events-none">
          <span className="text-body-bold text-th-secondary leading-none">{powerLabel}</span>
          <span className={`text-feature leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
          {need > 0 && demandQty === 0 && <span className="text-micro font-bold text-warning leading-none">need {need}</span>}
          {demandQty > 0 && <span className="text-micro font-bold text-primary-500 leading-none">+{demandQty}</span>}
        </div>
      ) : (
        <button
          onClick={onAdd}
          disabled={atMax}
          className="flex flex-col items-center gap-1.5 w-full disabled:cursor-not-allowed"
        >
          <span className="text-body-bold text-th-secondary leading-none">{powerLabel}</span>
          <span className={`text-feature leading-none ${isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
        </button>
      )}
    </div>
  );
});

const CompoundLensCard = memo(function CompoundLensCard({ powerKey, qty, inCart, cartQty: _cartQty, atMax, onAdd, onRemove, demandMode = false, demandQty = 0, need = 0, onToggleDemand, onRemoveDemand }: {
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
  demandMode?: boolean;
  demandQty?: number;
  need?: number;
  onToggleDemand?: () => void;
  onRemoveDemand?: () => void;
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

  const selectedBorder = demandMode
    ? demandQty > 0
      ? "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
      : baseBorder
    : inCart
    ? atMax
      ? "border-warning/70 bg-warning/10 ring-1 ring-warning/20"
      : "border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20"
    : baseBorder;

  return (
    <div
      data-lens-card
      onClick={demandMode ? () => onToggleDemand && onToggleDemand() : undefined}
      className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all duration-150 ${selectedBorder} ${demandMode ? "cursor-pointer" : ""} ${inCart && !atMax && !demandMode ? "animate-selected-pulse" : ""} ${atMax && !demandMode ? "opacity-60" : ""}`}
    >
      {demandMode ? (
        demandQty > 0 && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onRemoveDemand && onRemoveDemand(); }}
            className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center cursor-pointer active:scale-90 z-10"
            title="Remove from demand"
          >
            <span className="text-micro font-bold leading-none">{demandQty}</span>
          </span>
        )
      ) : (
        inCart && (
          <span
            role="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
          >
            <X size={13} className="text-white" strokeWidth={3} />
          </span>
        )
      )}
      {demandMode ? (
        <div className="flex flex-col items-center gap-1.5 w-full pointer-events-none">
          <span className="text-body-bold leading-none whitespace-nowrap">
            <span className={sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-secondary"}>{sphLabel}</span>
            <span className="text-th-muted"> | </span>
            <span className={cylNeg ? "text-amber-500" : cylPos ? "text-emerald-500" : "text-th-muted"}>{cylLabel}</span>
          </span>
          <span className={`text-feature leading-none ${sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
          {need > 0 && demandQty === 0 && <span className="text-micro font-bold text-warning leading-none">need {need}</span>}
          {demandQty > 0 && <span className="text-micro font-bold text-primary-500 leading-none">+{demandQty}</span>}
        </div>
      ) : (
        <button
          onClick={onAdd}
          disabled={atMax}
          className="flex flex-col items-center gap-1.5 w-full disabled:cursor-not-allowed"
        >
          <span className="text-body-bold leading-none whitespace-nowrap">
            <span className={sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-secondary"}>{sphLabel}</span>
            <span className="text-th-muted"> | </span>
            <span className={cylNeg ? "text-amber-500" : cylPos ? "text-emerald-500" : "text-th-muted"}>{cylLabel}</span>
          </span>
          <span className={`text-feature leading-none ${sphNeg ? "text-amber-500" : sphPos ? "text-emerald-500" : "text-th-muted"}`}>{qty}</span>
        </button>
      )}
    </div>
  );
});

const PlainView = memo(function PlainView({ quantities, coating, addToCart, isInCart, getItemQty, removeByDetails, demandMode, demandTarget, getDemandQty, onToggleDemand, onRemoveDemand }: {
  quantities: Record<string, number>;
  coating: string;
  addToCart: (coating: string, lensType: string, powerKey: string) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
  demandMode?: boolean;
  demandTarget?: number;
  getDemandQty?: (key: string) => number;
  onToggleDemand?: (key: string) => void;
  onRemoveDemand?: (key: string) => void;
}) {
  const powerKey = "+0.00";
  const qty = ZERO_KEYS.reduce((sum, k) => sum + (quantities[k] || 0), 0);
  const currentCartQty = getItemQty(coating, "sph", powerKey);
  const atMax = qty > 0 && currentCartQty >= qty;
  const dKey = demandKey(coating, "sph", powerKey);
  const need = demandTarget !== undefined ? Math.max(0, demandTarget - qty) : 0;
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-2">
      <LensCard
        coating={coating}
        lensType="sph"
        powerKey={powerKey}
        qty={qty}
        inCart={isInCart(coating, "sph", powerKey)}
        cartQty={currentCartQty}
        atMax={atMax}
        onAdd={(e) => {
          if (qty <= 0 || currentCartQty >= qty) return;
          addToCart(coating, "sph", powerKey);
          flyToCart(e.currentTarget);
        }}
        onRemove={() => removeByDetails(coating, "sph", powerKey)}
        demandMode={demandMode}
        demandQty={demandMode ? getDemandQty?.(dKey) || 0 : 0}
        need={need}
        onToggleDemand={demandMode ? () => onToggleDemand?.(dKey) : undefined}
        onRemoveDemand={demandMode ? () => onRemoveDemand?.(dKey) : undefined}
      />
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
  demandMode?: boolean;
  demandTarget?: number;
  getDemandQty?: (key: string) => number;
  onToggleDemand?: (key: string) => void;
  onRemoveDemand?: (key: string) => void;
}

const FlatGrid = memo(function FlatGrid({ quantities, coating, lensType, addToCart, isInCart, getItemQty, removeByDetails, demandMode, demandTarget, getDemandQty, onToggleDemand, onRemoveDemand }: FlatGridProps) {
  const [openGroup, setOpenGroup] = useState<string>("Negative");

  const negatives = useMemo(() =>
    POWER_VALUES.filter((p) => p.startsWith("-") && p !== "-0.00").reverse(),
  []);
  const positives = useMemo(() =>
    POWER_VALUES.filter((p) => p.startsWith("+") && p !== "+0.00"),
  []);

  const stockCount = useMemo(() => (powers: string[]) => powers.filter((p) => (quantities[p] || 0) > 0).length, [quantities]);

  function toggle(label: string) {
    setOpenGroup((prev) => (prev === label ? "" : label));
  }

  const groups: { label: string; powers: string[]; color: string }[] = [
    { label: "Negative", powers: negatives, color: "text-amber-500" },
    { label: "Positive", powers: positives, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = openGroup === group.label;
        return (
          <div key={group.label}>
            <button
              onClick={() => toggle(group.label)}
              className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg hover:bg-th-elevated transition-colors"
            >
              {isOpen ? <ChevronDown size={20} className="text-th-muted" /> : <ChevronRight size={20} className="text-th-muted" />}
              <span className={`text-body-bold font-bold uppercase tracking-wider ${group.color}`}>{group.label}</span>
              <span className="text-body text-th-muted font-medium">({stockCount(group.powers)} in stock)</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-2">
                {group.powers.map((power) => {
                  const qty = quantities[power] || 0;
                  const currentCartQty = getItemQty(coating, lensType, power);
                  const atMax = qty > 0 && currentCartQty >= qty;
                  const dKey = demandKey(coating, lensType, power);
                  const need = demandTarget !== undefined ? Math.max(0, demandTarget - qty) : 0;
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
                        if (stockQty <= 0 || currentCartQty >= stockQty) return;
                        addToCart(coating, lensType, power);
                        flyToCart(e.currentTarget);
                      }}
                      onRemove={() => removeByDetails(coating, lensType, power)}
                      demandMode={demandMode}
                      demandQty={demandMode ? getDemandQty?.(dKey) || 0 : 0}
                      need={need}
                      onToggleDemand={demandMode ? () => onToggleDemand?.(dKey) : undefined}
                      onRemoveDemand={demandMode ? () => onRemoveDemand?.(dKey) : undefined}
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
  demandMode?: boolean;
  demandTarget?: number;
  getDemandQty?: (key: string) => number;
  onToggleDemand?: (key: string) => void;
  onRemoveDemand?: (key: string) => void;
}

const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});
const negCylList = CYL_RANGE.filter((p) => p.startsWith("-")).reverse();
const posCylList = CYL_RANGE.filter((p) => p.startsWith("+") && p !== "+0.00");

const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -6 && n <= -0.25) || (n >= 0.25 && n <= 6);
});
const negSphInner = SPH_INNER.filter((p) => p.startsWith("-")).reverse();
const posSphInner = SPH_INNER.filter((p) => p.startsWith("+") && p !== "+0.00");

const CompoundView = memo(function CompoundView({ quantities, coating, addToCart, isInCart, getItemQty, removeByDetails, demandMode, demandTarget, getDemandQty, onToggleDemand, onRemoveDemand }: CompoundViewProps) {
  const [openCyl, setOpenCyl] = useState<string>("");

  const cylGroups: { label: string; values: string[]; color: string }[] = [
    { label: "Negative CYL", values: negCylList, color: "text-amber-500" },
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
            <div className="text-body font-bold uppercase tracking-wider mb-2 px-1">{group.label}</div>
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
                      className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg hover:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={20} className="text-th-muted" /> : <ChevronRight size={20} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylColor} text-body-bold`}>
                        CYL {cyl}
                      </span>
                      <span className="text-body text-primary-500 font-medium">{sphStockCount} in stock</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-3">
                        {sphInnerGroups.map((sphGroup) => (
                          <div key={sphGroup.label}>
                            <div className="text-body font-bold uppercase tracking-wider mb-2 px-1 text-th-muted">{sphGroup.label}</div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                              {sphGroup.values.map((sph) => {
                                const key = `${sph}|${cyl}`;
                                const qty = quantities[key] || 0;
                                const inCart = isInCart(coating, "compound", key);
                                const cartQty = getItemQty(coating, "compound", key);
                                const atMax = qty <= 0 || cartQty >= qty;
                                const dKey = demandKey(coating, "compound", key);
                                const need = demandTarget !== undefined ? Math.max(0, demandTarget - qty) : 0;
                                return (
                                  <CompoundLensCard
                                    key={key}
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
                                    demandMode={demandMode}
                                    demandQty={demandMode ? getDemandQty?.(dKey) || 0 : 0}
                                    need={need}
                                    onToggleDemand={demandMode ? () => onToggleDemand?.(dKey) : undefined}
                                    onRemoveDemand={demandMode ? () => onRemoveDemand?.(dKey) : undefined}
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
  const [lensType, setLensType] = useState<TabKey>("sph");
  const [loading, setLoading] = useState(true);
  const [demandMode, setDemandMode] = useState(false);
  const [demandTarget, setDemandTarget] = useState(10);
  const [demandSel, setDemandSel] = useState<Map<string, number>>(new Map());
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

  const incrementDemand = (key: string) => {
    setDemandSel((prev) => {
      const next = new Map(prev);
      next.set(key, (next.get(key) || 0) + 1);
      return next;
    });
  };

  const removeDemand = (key: string) => {
    setDemandSel((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const selectAllLowStock = () => {
    const next = new Map<string, number>();
    for (const item of items) {
      const zeroQty = ZERO_KEYS.reduce((sum, k) => sum + (item.quantities?.sph?.[k] || 0), 0);
      if (zeroQty < demandTarget) next.set(demandKey(item.coating, "sph", "+0.00"), demandTarget - zeroQty);
      for (const lensType of ["sph", "cyl", "compound"] as LensType[]) {
        const map = item.quantities?.[lensType] || {};
        for (const [key, qty] of Object.entries(map)) {
          if (lensType === "sph" && ZERO_KEYS.includes(key)) continue;
          if ((qty || 0) < demandTarget) next.set(demandKey(item.coating, lensType, key), demandTarget - (qty || 0));
        }
      }
    }
    setDemandSel(next);
    toast(`Selected all lens powers below ${demandTarget}`, "success");
  };

  const clearDemandSelection = () => setDemandSel(new Map());

  const demandRows = useMemo(() => {
    const rows: Array<{ coating: string; lensType: string; powerKey: string; current: number; target: number; qty: number; price: number }> = [];
    for (const [key, qty] of demandSel) {
      const parsed = parseDemandKey(key);
      if (!parsed) continue;
      const item = items.find((i) => i.coating === parsed.coating);
      if (!item) continue;
      const current = getQtyFor(item, parsed.lensType, parsed.powerKey);
      rows.push({
        coating: item.coating,
        lensType: parsed.lensType,
        powerKey: parsed.powerKey,
        current,
        target: demandTarget,
        qty,
        price: priceForPower(item, parsed.powerKey) || 0,
      });
    }
    return rows.sort((a, b) => a.coating.localeCompare(b.coating) || a.lensType.localeCompare(b.lensType) || a.powerKey.localeCompare(b.powerKey));
  }, [demandSel, items, demandTarget]);

  const totalNeed = demandRows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = demandRows.reduce((s, r) => s + r.qty * r.price, 0);

  const handleDownloadDemand = () => {
    if (demandRows.length === 0) {
      toast("Select at least one lens to generate demand", "error");
      return;
    }
    generateDemandPdf({ target: demandTarget, generatedAt: new Date().toISOString(), items: demandRows });
  };

  const selectedItem = useMemo(() => items.find((i) => i._id === selectedId) || null, [items, selectedId]);
  const quantities = useMemo(() => {
    const map = lensType === "plain" ? (selectedItem?.quantities?.sph || {}) : (selectedItem?.quantities?.[lensType] || {});
    return map as Record<string, number>;
  }, [selectedItem, lensType]);

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
        <button
          onClick={() => setDemandMode((m) => !m)}
          className={`ml-auto flex items-center gap-2 px-4 py-2.5 rounded-pill text-small-bold transition-all active:scale-95 ${
            demandMode
              ? "bg-primary-500 text-surface-950 shadow-sm"
              : "bg-th-elevated text-th-secondary border border-th-border hover:text-th-text"
          }`}
          aria-label="Stock Demand"
        >
          <ClipboardList size={18} />
          <span className="hidden sm:inline">Stock Demand</span>
        </button>
      </div>

      {demandMode && (
        <div className="flex items-center gap-2 flex-wrap bg-th-surface border border-th-border rounded-xl px-3.5 py-2.5">
          <span className="text-small-bold text-th-secondary">Fill each power up to</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDemandTarget((t) => Math.max(1, t - 1))}
              className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Decrease target"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              value={demandTarget}
              onChange={(e) => setDemandTarget(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 h-8 text-center text-small-bold bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
              aria-label="Target stock level"
            />
            <button
              onClick={() => setDemandTarget((t) => t + 1)}
              className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Increase target"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-small text-th-muted">— Suggested to fill to target; tap a lens to add 1, tap again for more. Tap the badge to remove.</span>
        </div>
      )}

      {/* Mobile: coating select + lens type tabs */}
      <div className="lg:hidden space-y-2.5">
        <div className="relative">
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl bg-th-surface border border-th-border text-small-bold text-th-text appearance-none cursor-pointer pr-10"
          >
            {items.map((item) => {
              const total = getTotalQty(item);
              return (
                <option key={item._id} value={item._id}>
                  {item.coating} · {total} in stock · −₹{item.priceNeg ?? 0}/+₹{item.pricePos ?? 0}
                </option>
              );
            })}
          </select>
          <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none" />
        </div>
        <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setLensType(t.key)}
              className={`flex-1 px-2 py-2.5 rounded-pill text-small-bold transition-all ${
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
        <div className="hidden lg:flex w-60 shrink-0 card p-4 flex-col overflow-hidden">
          <h3 className="text-small font-bold text-th-text uppercase tracking-wider mb-4 flex items-center justify-between">
            Coatings
            <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-th-muted text-micro font-bold">{items.length}</span>
          </h3>
          <div className="flex-1 overflow-auto scrollbar-thin space-y-1.5">
            {items.map((item) => {
              const total = getTotalQty(item);
              const isSelected = item._id === selectedId;
              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`flex items-center gap-3 px-3.5 py-3.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-primary-500/10 border border-primary-500/30 shadow-sm ring-1 ring-primary-500/10"
                      : "hover:bg-th-elevated border border-transparent hover:border-th-border"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-small-bold truncate ${isSelected ? "text-th-text" : "text-th-secondary"}`}>
                      {item.coating}
                    </div>
                    <div className={`text-small mt-0.5 font-medium ${total > 0 ? "text-primary-500" : "text-th-muted"}`}>
                      {total > 0 ? `${total} in stock` : "Empty"}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-small font-bold text-th-muted">−₹{item.priceNeg ?? 0}/+₹{item.pricePos ?? 0}</span>
                    {total > 0 && (
                      <span className={`px-2 py-0.5 rounded-pill text-micro font-bold ${isSelected ? "bg-primary-500 text-surface-950" : "bg-primary-500/15 text-primary-500"}`}>
                        {total}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 card p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-th-border">
                <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                <span className="text-body-bold font-bold text-th-text truncate">{selectedItem.coating}</span>
                <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-th-secondary text-micro font-bold shrink-0">
                  {getTotalQty(selectedItem)} in stock
                </span>
                <span className="text-small-bold text-primary-500 shrink-0">−₹{selectedItem.priceNeg ?? 0}/+₹{selectedItem.pricePos ?? 0}</span>
                <div className="ml-auto hidden lg:flex gap-1 bg-th-elevated rounded-pill p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setLensType(t.key)}
                      className={`px-3.5 py-2 rounded-pill text-small-bold transition-all ${
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
                    demandMode={demandMode}
                    demandTarget={demandMode ? demandTarget : undefined}
                    getDemandQty={demandMode ? (key) => demandSel.get(key) || 0 : undefined}
                    onToggleDemand={demandMode ? incrementDemand : undefined}
                    onRemoveDemand={demandMode ? removeDemand : undefined}
                  />
                ) : lensType === "plain" ? (
                  <PlainView
                    quantities={quantities}
                    coating={selectedItem.coating}
                    addToCart={addToCart}
                    isInCart={isInCart}
                    getItemQty={getItemQty}
                    removeByDetails={removeByDetails}
                    demandMode={demandMode}
                    demandTarget={demandMode ? demandTarget : undefined}
                    getDemandQty={demandMode ? (key) => demandSel.get(key) || 0 : undefined}
                    onToggleDemand={demandMode ? incrementDemand : undefined}
                    onRemoveDemand={demandMode ? removeDemand : undefined}
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
                    demandMode={demandMode}
                    demandTarget={demandMode ? demandTarget : undefined}
                    getDemandQty={demandMode ? (key) => demandSel.get(key) || 0 : undefined}
                    onToggleDemand={demandMode ? incrementDemand : undefined}
                    onRemoveDemand={demandMode ? removeDemand : undefined}
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

      {demandMode && (
        <div className="sticky bottom-[72px] lg:bottom-2 z-20">
          <div className="bg-th-surface border border-th-border rounded-xl px-3.5 py-3 shadow-lifted flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ClipboardList size={18} className="text-primary-500 shrink-0" />
              <span className="text-small-bold text-th-text">
                {demandSel.size} lens{demandSel.size !== 1 ? "es" : ""} selected
              </span>
              <span className="text-small text-th-muted hidden md:inline">·</span>
              <span className="text-small text-th-secondary hidden md:inline">
                <span className="text-primary-500 font-bold">{totalNeed}</span> pcs to buy
              </span>
              <span className="text-small text-th-secondary hidden lg:inline">
                · <span className="text-primary-500 font-bold">₹{totalAmount.toLocaleString("en-IN")}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={selectAllLowStock}
                className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-th-text text-small-bold border border-th-border"
              >
                All low stock
              </button>
              <button
                onClick={clearDemandSelection}
                disabled={demandSel.size === 0}
                className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-negative text-small-bold border border-th-border disabled:opacity-40"
              >
                Clear
              </button>
              <button
                onClick={handleDownloadDemand}
                disabled={demandRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
