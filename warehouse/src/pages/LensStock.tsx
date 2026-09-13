import { useState, useEffect, useMemo, memo } from 'react';
import type { LensStockItem, LensType } from '../types/lensStock';
import api from '../api';
import { useToast } from '../context';
import { useCart } from '../context/CartContext';
import { useLocalStorage } from '../hooks';
import { flyToCart } from '../utils/flyToCart';
import { Glasses, ChevronDown, ChevronRight, X } from 'lucide-react';
import { fmtPairs } from '../utils/helpers';
import { POWER_VALUES } from '../constants';
import { coatingColor } from '../utils/coatingColors';
import { setHeaderCoating } from '../utils/headerCoating';

function getTotalQty(item: LensStockItem): number {
  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  let total = 0;
  for (const lensType of ['sph', 'cyl', 'compound']) {
    const map = q[lensType];
    if (map) {
      for (const v of Object.values(map)) {
        total += v as number;
      }
    }
  }
  return total;
}

const ZERO_KEYS = ['+0.00', '0.00', '-0.00'];

type TabKey = LensType | 'plain';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'plain', label: 'Plain' },
  { key: 'sph', label: 'SPH' },
  { key: 'cyl', label: 'CYL' },
  { key: 'compound', label: 'Compound' },
];

const LensCard = memo(function LensCard({
  coating: _coating,
  lensType: _lensType,
  powerKey,
  qty,
  inCart,
  cartQty: _cartQty,
  atMax,
  onAdd,
  onRemove,
}: {
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
  const isNeg = powerKey.startsWith('-');
  const isPos = powerKey.startsWith('+') && powerKey !== '+0.00';
  const isZero = powerKey === '+0.00' || powerKey === '0.00' || powerKey === '-0.00';
  const powerLabel = isZero ? '0.00' : powerKey;

  const baseBorder = isNeg
    ? 'border-amber-400/40 bg-amber-400/10'
    : isPos
      ? 'border-emerald-400/40 bg-emerald-400/10'
      : 'border-th-border bg-th-elevated';

  const selectedBorder = inCart
    ? atMax
      ? 'border-warning/70 bg-warning/10 ring-1 ring-warning/20'
      : 'border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20'
    : baseBorder;

  return (
    <div
      data-lens-card
      className={`relative flex flex-col items-center gap-1.5 py-4 px-3 rounded-lg border transition-all duration-150 ${selectedBorder} ${inCart && !atMax ? 'animate-selected-pulse' : ''} ${atMax ? 'opacity-60' : ''}`}
    >
      {inCart && (
        <span
          role="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={13} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-1.5 w-full disabled:cursor-not-allowed"
      >
        <span className="text-body-bold text-th-secondary leading-none">{powerLabel}</span>
        <span
          className={`text-feature leading-none ${isNeg ? 'text-amber-500' : isPos ? 'text-emerald-500' : 'text-th-muted'}`}
        >
          {fmtPairs(qty)}
        </span>
      </button>
    </div>
  );
});

const CompoundLensCard = memo(function CompoundLensCard({
  powerKey,
  qty,
  inCart,
  cartQty: _cartQty,
  atMax,
  onAdd,
  onRemove,
  }: {
  powerKey: string;
  qty: number;
  inCart: boolean;
  cartQty: number;
  atMax: boolean;
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const sph = powerKey.split('|')[0];
  const cyl = powerKey.split('|')[1] || '';
  const sphLabel = sph === '+0.00' || sph === '0.00' || sph === '-0.00' ? '0.00' : sph;
  const cylLabel = cyl === '+0.00' || cyl === '0.00' || cyl === '-0.00' ? '0.00' : cyl;
  const sphNeg = sph.startsWith('-');
  const sphPos = sph.startsWith('+') && sph !== '+0.00';
  const cylNeg = cyl.startsWith('-');
  const cylPos = cyl.startsWith('+') && cyl !== '+0.00';

  const baseBorder = sphNeg
    ? 'border-amber-400/40 bg-amber-400/5'
    : sphPos
      ? 'border-emerald-400/40 bg-emerald-400/5'
      : 'border-th-border bg-th-elevated';

  const selectedBorder = inCart
    ? atMax
      ? 'border-warning/70 bg-warning/10 ring-1 ring-warning/20'
      : 'border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20'
    : baseBorder;

  return (
    <div
      data-lens-card
      className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all duration-150 ${selectedBorder} ${inCart && !atMax ? 'animate-selected-pulse' : ''} ${atMax ? 'opacity-60' : ''}`}
    >
      {inCart && (
        <span
          role="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-negative flex items-center justify-center cursor-pointer active:scale-90 z-10"
        >
          <X size={13} className="text-white" strokeWidth={3} />
        </span>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={atMax}
        className="flex flex-col items-center gap-1.5 w-full disabled:cursor-not-allowed"
      >
        <span className="text-body-bold leading-none whitespace-nowrap">
          <span
            className={
              sphNeg ? 'text-amber-500' : sphPos ? 'text-emerald-500' : 'text-th-secondary'
            }
          >
            {sphLabel}
          </span>
          <span className="text-th-muted">&nbsp;</span>
          <span
            className={cylNeg ? 'text-amber-500' : cylPos ? 'text-emerald-500' : 'text-th-muted'}
          >
            {cylLabel}
          </span>
        </span>
        <span
          className={`text-feature leading-none ${sphNeg ? 'text-amber-500' : sphPos ? 'text-emerald-500' : 'text-th-muted'}`}
        >
          {fmtPairs(qty)}
        </span>
      </button>
    </div>
  );
});

const PlainView = memo(function PlainView({
  quantities,
  coating,
  addToCart,
  isInCart,
  getItemQty,
  removeByDetails,
}: {
  quantities: Record<string, number>;
  coating: string;
  addToCart: (
    coating: string,
    lensType: string,
    powerKey: string,
    quantity?: number
  ) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}) {
  const powerKey = '+0.00';
  const qty = ZERO_KEYS.reduce((sum, k) => sum + (quantities[k] || 0), 0);
  const currentCartQty = getItemQty(coating, 'sph', powerKey);
  const atMax = qty > 0 && currentCartQty >= qty;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 mt-2">
      <LensCard
        coating={coating}
        lensType="sph"
        powerKey={powerKey}
        qty={qty}
        inCart={isInCart(coating, 'sph', powerKey)}
        cartQty={currentCartQty}
        atMax={atMax}
        onAdd={(e) => {
          if (qty <= 0 || currentCartQty >= qty) return;
          addToCart(coating, 'sph', powerKey, 1);
          flyToCart(e.currentTarget);
        }}
        onRemove={() => removeByDetails(coating, 'sph', powerKey)}
      />
    </div>
  );
});

interface FlatGridProps {
  quantities: Record<string, number>;
  coating: string;
  lensType: LensType;
  addToCart: (
    coating: string,
    lensType: string,
    powerKey: string,
    quantity?: number
  ) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

const FlatGrid = memo(function FlatGrid({
  quantities,
  coating,
  lensType,
  addToCart,
  isInCart,
  getItemQty,
  removeByDetails,
}: FlatGridProps) {
  const [openGroup, setOpenGroup] = useState<string>('Negative');

  const negatives = useMemo(
    () => POWER_VALUES.filter((p) => p.startsWith('-') && p !== '-0.00').reverse(),
    []
  );
  const positives = useMemo(
    () => POWER_VALUES.filter((p) => p.startsWith('+') && p !== '+0.00'),
    []
  );

  const stockCount = useMemo(
    () => (powers: string[]) => powers.filter((p) => (quantities[p] || 0) > 0).length,
    [quantities]
  );

  function toggle(label: string) {
    setOpenGroup((prev) => (prev === label ? '' : label));
  }

  const groups: { label: string; powers: string[]; color: string }[] = [
    { label: 'Negative', powers: negatives, color: 'text-amber-500' },
    { label: 'Positive', powers: positives, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = openGroup === group.label;
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggle(group.label)}
              className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg hover:bg-th-elevated transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={20} className="text-th-muted" />
              ) : (
                <ChevronRight size={20} className="text-th-muted" />
              )}
              <span className={`text-body-bold font-bold uppercase tracking-wider ${group.color}`}>
                {group.label}
              </span>
              <span className="text-body text-th-muted font-medium">
                ({stockCount(group.powers)} in stock)
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 mt-2">
                {group.powers.map((power) => {
                  const qty = quantities[power] || 0;
                  const currentCartQty = getItemQty(coating, lensType, power);
                  const atMax = qty > 0 && currentCartQty >= qty;
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
                        addToCart(coating, lensType, power, 1);
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
  addToCart: (
    coating: string,
    lensType: string,
    powerKey: string,
    quantity?: number
  ) => Promise<boolean>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => void;
}

const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});
const negCylList = CYL_RANGE.filter((p) => p.startsWith('-')).reverse();
const posCylList = CYL_RANGE.filter((p) => p.startsWith('+') && p !== '+0.00');

const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -6 && n <= -0.25) || (n >= 0.25 && n <= 6);
});
const negSphInner = SPH_INNER.filter((p) => p.startsWith('-')).reverse();
const posSphInner = SPH_INNER.filter((p) => p.startsWith('+') && p !== '+0.00');

const CompoundView = memo(function CompoundView({
  quantities,
  coating,
  addToCart,
  isInCart,
  getItemQty,
  removeByDetails,
}: CompoundViewProps) {
  const [openCyl, setOpenCyl] = useState<string>('');

  const cylGroups: { label: string; values: string[]; color: string }[] = [
    { label: 'Negative CYL', values: negCylList, color: 'text-amber-500' },
    { label: 'Positive CYL', values: posCylList, color: 'text-emerald-500' },
  ];

  const sphInnerGroups: { label: string; values: string[]; color: string }[] = [
    { label: 'Negative SPH', values: negSphInner, color: 'text-amber-500' },
    { label: 'Positive SPH', values: posSphInner, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-2">
      {cylGroups.map((group) => {
        if (group.values.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="text-body font-bold uppercase tracking-wider mb-2 px-1">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.values.map((cyl) => {
                const isOpen = openCyl === cyl;
                const cylNeg = cyl.startsWith('-');
                const cylColor = cylNeg
                  ? 'text-amber-500'
                  : cyl === '+0.00'
                    ? 'text-th-muted'
                    : 'text-emerald-500';
                const cylBg = cylNeg
                  ? 'bg-amber-500/10'
                  : cyl === '+0.00'
                    ? 'bg-th-elevated'
                    : 'bg-emerald-500/10';

                const sphValues = cylNeg ? negSphInner : posSphInner;
                const sphStockCount = sphValues.filter(
                  (sph) => (quantities[`${sph}|${cyl}`] || 0) > 0
                ).length;

                return (
                  <div key={cyl}>
                    <button
                      type="button"
                      onClick={() => setOpenCyl((prev) => (prev === cyl ? '' : cyl))}
                      className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg hover:bg-th-elevated transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown size={20} className="text-th-muted" />
                      ) : (
                        <ChevronRight size={20} className="text-th-muted" />
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylColor} text-body-bold`}
                      >
                        CYL {cyl}
                      </span>
                      <span className="text-body text-primary-500 font-medium">
                        {sphStockCount} in stock
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-3">
                        {sphInnerGroups
                          .filter((g) =>
                            cylNeg ? g.label === 'Negative SPH' : g.label === 'Positive SPH'
                          )
                          .map((sphGroup) => (
                          <div key={sphGroup.label}>
                            <div className="text-body font-bold uppercase tracking-wider mb-2 px-1 text-th-muted">
                              {sphGroup.label}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2">
                              {sphGroup.values.map((sph) => {
                                const key = `${sph}|${cyl}`;
                                const qty = quantities[key] || 0;
                                const inCart = isInCart(coating, 'compound', key);
                                const cartQty = getItemQty(coating, 'compound', key);
                                const atMax = qty <= 0 || cartQty >= qty;
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
                                      const currentCartQty = getItemQty(coating, 'compound', key);
                                      if (stockQty <= 0 || currentCartQty >= stockQty) return;
                                      addToCart(coating, 'compound', key, 1);
                                      flyToCart(e.currentTarget);
                                    }}
                                    onRemove={() => removeByDetails(coating, 'compound', key)}
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
  const [selectedId, setSelectedId] = useLocalStorage<string | null>('wh_lens_selected_id', null);
  const [lensType, setLensType] = useLocalStorage<TabKey>('wh_lens_tab', 'plain');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { addToCart, isInCart, getItemQty, removeByDetails } = useCart();

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const res = await api.get<LensStockItem[]>('/api/warehouse/lens-stock/list');
      if (res.success && res.data) {
        setItems(res.data);
        if (res.data.length > 0) {
          if (selectedId && res.data.some((i) => i._id === selectedId)) {
            setSelectedId(selectedId);
          } else {
            setSelectedId(res.data[0]._id);
          }
        }
      } else {
        toast(res.message || 'Failed to load lens stock', 'error');
      }
      setLoading(false);
    }
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItem = useMemo(
    () => items.find((i) => i._id === selectedId) || null,
    [items, selectedId]
  );
  const activeCoating = selectedItem || items[0] || null;
  const quantities = useMemo(() => {
    const map =
      lensType === 'plain'
        ? selectedItem?.quantities?.sph || {}
        : selectedItem?.quantities?.[lensType] || {};
    return map as Record<string, number>;
  }, [selectedItem, lensType]);

  useEffect(() => {
    setHeaderCoating(activeCoating?.coating ?? null);
    return () => setHeaderCoating(null);
  }, [activeCoating]);

  if (loading) {
    return (
      <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0">
        {/* Mobile: coating cards + tabs */}
        <div className="lg:hidden space-y-2.5">
          <div className="flex gap-2 overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-28 h-14 rounded-xl bg-th-hover animate-pulse shrink-0"
              />
            ))}
          </div>
          <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 h-9 rounded-pill bg-th-hover animate-pulse" />
            ))}
          </div>
        </div>

        {/* Desktop: sidebar + content */}
        <div className="flex-1 flex gap-4 min-h-0">
          <div className="hidden lg:flex w-60 shrink-0 card p-4 flex-col gap-2">
            <div className="h-4 w-20 rounded bg-th-hover animate-pulse mb-2" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-th-hover animate-pulse" />
            ))}
          </div>
          <div className="flex-1 card p-2 sm:p-3 lg:p-4">
            <div className="hidden lg:flex items-center justify-end mb-2 pb-2 border-b border-th-border">
              <div className="flex gap-1 bg-th-elevated rounded-pill p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-14 h-7 rounded-pill bg-th-hover animate-pulse" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-th-hover animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      {/* Mobile: coating cards + lens type tabs */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-0.5 -mx-1 px-1">
          {items.map((item) => {
            const isSelected = item._id === selectedId;
            const color = coatingColor(item.coating);
            const total = getTotalQty(item);
            return (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelectedId(item._id)}
                aria-pressed={isSelected}
                className={`flex flex-col items-start gap-0.5 px-3.5 py-2.5 rounded-xl border text-left shrink-0 transition-all active:scale-95 ${
                  isSelected
                    ? `${color.border} ${color.softBg} ring-1 ${color.ring} shadow-sm`
                    : 'border-th-border bg-th-surface hover:bg-th-elevated'
                }`}
              >
                <span
                  className={`text-small-bold leading-tight ${isSelected ? color.text : 'text-th-secondary'}`}
                >
                  {item.coating}
                </span>
                <span className="text-micro font-medium text-th-muted">
                  {total > 0 ? `${fmtPairs(total)} in stock` : 'Empty'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setLensType(t.key)}
              className={`flex-1 px-2 py-2.5 rounded-pill text-small-bold transition-all ${
                lensType === t.key
                  ? 'bg-primary-500 text-surface-950 shadow-sm'
                  : 'text-th-secondary'
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
            <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-th-muted text-micro font-bold">
              {items.length}
            </span>
          </h3>
          <div className="flex-1 overflow-auto scrollbar-thin space-y-1.5">
            {items.map((item) => {
              const total = getTotalQty(item);
              const isSelected = item._id === selectedId;
              const color = coatingColor(item.coating);
              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`flex items-center gap-3 px-3.5 py-3.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? `${color.border} ${color.softBg} border shadow-sm ring-1 ${color.ring}`
                      : 'hover:bg-th-elevated border border-transparent hover:border-th-border'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot} ${isSelected ? '' : 'opacity-40'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-small-bold truncate ${isSelected ? color.text : 'text-th-secondary'}`}
                    >
                      {item.coating}
                    </div>
                    <div className="text-small mt-0.5 font-medium text-th-muted">
                      {total > 0 ? `${fmtPairs(total)} in stock` : 'Empty'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 card p-2 sm:p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="hidden lg:flex items-center justify-end mb-2 pb-2 border-b border-th-border">
                <div className="flex gap-1 bg-th-elevated rounded-pill p-1">
                  {TABS.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setLensType(t.key)}
                      className={`px-3.5 py-2 rounded-pill text-small-bold transition-all ${
                        lensType === t.key
                          ? 'bg-primary-500 text-surface-950 shadow-sm'
                          : 'text-th-secondary hover:text-th-text'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {lensType === 'compound' ? (
                  <CompoundView
                    quantities={quantities}
                    coating={selectedItem.coating}
                    addToCart={addToCart}
                    isInCart={isInCart}
                    getItemQty={getItemQty}
                    removeByDetails={removeByDetails}
                  />
                ) : lensType === 'plain' ? (
                  <PlainView
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
