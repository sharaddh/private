import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { LensStockItem, LensType } from "../../types";
import {
  ZERO_KEYS,
  NEGATIVE_POWERS,
  POSITIVE_POWERS,
  NEG_CYL,
  POS_CYL,
  NEG_SPH_INNER,
  POS_SPH_INNER,
  SPH_INNER,
  type TabKey,
} from "./powers";

export function demandKey(coating: string, lensType: string, powerKey: string): string {
  return `${coating}::${lensType}::${powerKey}`;
}

export function parseDemandKey(key: string): { coating: string; lensType: string; powerKey: string } | null {
  const [coating, lensType, powerKey] = key.split("::");
  if (!coating || !lensType || !powerKey) return null;
  return { coating, lensType, powerKey };
}

export function getQtyFor(item: LensStockItem, lensType: string, powerKey: string): number {
  const q = item.quantities;
  if (!q) return 0;
  if (lensType === "sph" && ZERO_KEYS.includes(powerKey)) {
    return ZERO_KEYS.reduce((sum, k) => sum + (q.sph?.[k] || 0), 0);
  }
  return q[lensType as LensType]?.[powerKey] || 0;
}

interface DemandCellProps {
  power: string;
  qty: number;
  need: number;
  demandQty: number;
  onToggle: () => void;
  onRemove: () => void;
}

function DemandCell({ power, qty, need, demandQty, onToggle, onRemove }: DemandCellProps) {
  const isNeg = power.startsWith("-");
  const isPos = power.startsWith("+") && power !== "+0.00";
  const isZero = power === "+0.00" || power === "0.00";
  const selected = demandQty > 0;

  const border = selected
    ? "border-primary-500/60 bg-primary-500/5"
    : "border-th-border bg-th-surface hover:border-th-border-med";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-secondary";

  return (
    <div onClick={onToggle} className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border cursor-pointer transition-all ${border}`}>
      {selected && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center shadow-sm"
          aria-label="Remove from demand"
        >
          <X size={11} strokeWidth={3} />
        </button>
      )}
      <span className="text-sm sm:text-base font-bold text-th-secondary leading-none">{isZero ? "0.00" : power}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg sm:text-xl font-bold leading-none ${qty > 0 ? qtyClr : "text-th-muted"}`}>{qty}</span>
        {selected ? (
          <span className="text-micro font-bold text-primary-500 leading-none">+{demandQty}</span>
        ) : need > 0 ? (
          <span className="text-micro font-bold text-warning leading-none">need {need}</span>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  item: LensStockItem;
  lensType: TabKey;
  demandTarget: number;
  demandSel: Map<string, number>;
  onToggleDemand: (key: string) => void;
  onRemoveDemand: (key: string) => void;
}

export default function LensDemandGrid({ item, lensType, demandTarget, demandSel, onToggleDemand, onRemoveDemand }: Props) {
  const [openGroup, setOpenGroup] = useState<string>("Negative");

  const coating = item.coating;
  const quantities =
    lensType === "plain" ? item.quantities?.sph || {} : item.quantities?.[lensType as LensType] || {};

  const toggle = (label: string) => setOpenGroup((prev) => (prev === label ? "" : label));

  const demandQtyFor = (lensTypeKey: LensType, powerKey: string): number =>
    demandSel.get(demandKey(coating, lensTypeKey, powerKey)) || 0;

  if (lensType === "compound") {
    const cylGroups: { label: string; values: string[] }[] = [
      { label: "Negative CYL", values: NEG_CYL },
      { label: "Positive CYL", values: POS_CYL },
    ];
    const sphInnerGroups: { label: string; values: string[] }[] = [
      { label: "Negative SPH", values: NEG_SPH_INNER },
      { label: "Positive SPH", values: POS_SPH_INNER },
    ];
    return (
      <div className="space-y-2">
        {cylGroups.map((group) => {
          if (group.values.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="text-body font-bold uppercase tracking-wider mb-2 ml-1">{group.label}</div>
              <div className="space-y-1">
                {group.values.map((cyl) => {
                  const isOpen = openGroup === cyl;
                  let sphStockCount = 0;
                  for (const sph of SPH_INNER) {
                    if ((quantities[`${sph}|${cyl}`] || 0) > 0) sphStockCount++;
                  }
                  return (
                    <div key={cyl}>
                      <button type="button"
                        onClick={() => toggle(cyl)}
                        className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
                      >
                        {isOpen ? <ChevronDown size={20} className="text-th-muted" /> : <ChevronRight size={20} className="text-th-muted" />}
                        <span className="px-2.5 py-0.5 rounded-pill bg-th-elevated text-th-muted text-body font-bold">CYL {cyl === "+0.00" || cyl === "0.00" ? "0.00" : cyl}</span>
                        <span className="text-body text-primary-500 font-medium">{sphStockCount} in stock</span>
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-3">
                          {sphInnerGroups.map((sphGroup) => (
                            <div key={sphGroup.label}>
                              <div className="text-body font-bold uppercase tracking-wider mb-2 px-1 text-th-muted">{sphGroup.label}</div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {sphGroup.values.map((sph) => {
                                  const key = `${sph}|${cyl}`;
                                  const qty = quantities[key] || 0;
                                  const need = Math.max(0, demandTarget - qty);
                                  const dKey = demandKey(coating, "compound", key);
                                  return (
                                    <DemandCell
                                      key={sph}
                                      power={`${sph === "+0.00" || sph === "0.00" || sph === "-0.00" ? "0.00" : sph} | ${cyl === "+0.00" || cyl === "0.00" ? "0.00" : cyl}`}
                                      qty={qty}
                                      need={need}
                                      demandQty={demandSel.get(dKey) || 0}
                                      onToggle={() => onToggleDemand(dKey)}
                                      onRemove={() => onRemoveDemand(dKey)}
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
  }

  if (lensType === "plain") {
    const powerKey = "+0.00";
    const qty = getQtyFor(item, "sph", powerKey);
    const need = Math.max(0, demandTarget - qty);
    const dKey = demandKey(coating, "sph", powerKey);
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
        <DemandCell
          power="0.00"
          qty={qty}
          need={need}
          demandQty={demandSel.get(dKey) || 0}
          onToggle={() => onToggleDemand(dKey)}
          onRemove={() => onRemoveDemand(dKey)}
        />
      </div>
    );
  }

  const lensTypeKey: LensType = lensType;
  return (
    <div className="space-y-2">
      <div>
        <button type="button"
          onClick={() => toggle("Negative")}
          className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
        >
          {openGroup === "Negative" ? <ChevronDown size={20} className="text-amber-500" /> : <ChevronRight size={20} className="text-amber-500" />}
          <span className="px-2.5 py-0.5 rounded-pill bg-amber-500/10 text-amber-500 text-body font-bold">NEGATIVE</span>
          <span className="text-body text-th-muted">({NEGATIVE_POWERS.length})</span>
        </button>
        {openGroup === "Negative" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
            {NEGATIVE_POWERS.map((p) => {
              const qty = quantities[p] || 0;
              const need = Math.max(0, demandTarget - qty);
              const dKey = demandKey(coating, lensTypeKey, p);
              return (
                <DemandCell
                  key={p}
                  power={p}
                  qty={qty}
                  need={need}
                  demandQty={demandSel.get(dKey) || 0}
                  onToggle={() => onToggleDemand(dKey)}
                  onRemove={() => onRemoveDemand(dKey)}
                />
              );
            })}
          </div>
        )}
      </div>
      <div>
        <button type="button"
          onClick={() => toggle("Positive")}
          className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
        >
          {openGroup === "Positive" ? <ChevronDown size={20} className="text-emerald-500" /> : <ChevronRight size={20} className="text-emerald-500" />}
          <span className="px-2.5 py-0.5 rounded-pill bg-emerald-500/10 text-emerald-500 text-body font-bold">POSITIVE</span>
          <span className="text-body text-th-muted">({POSITIVE_POWERS.length})</span>
        </button>
        {openGroup === "Positive" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
            {POSITIVE_POWERS.map((p) => {
              const qty = quantities[p] || 0;
              const need = Math.max(0, demandTarget - qty);
              const dKey = demandKey(coating, lensTypeKey, p);
              return (
                <DemandCell
                  key={p}
                  power={p}
                  qty={qty}
                  need={need}
                  demandQty={demandSel.get(dKey) || 0}
                  onToggle={() => onToggleDemand(dKey)}
                  onRemove={() => onRemoveDemand(dKey)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
