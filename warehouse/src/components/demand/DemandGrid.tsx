import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LensStockItem, LensType } from '../../types/lensStock';
import { POWER_VALUES } from '../../constants';
import { fmtPairs, fmtP, roundHalf } from '../../utils/helpers';

// ── shared helpers ────────────────────────────────────────────────
export const ZERO_KEYS = ['+0.00', '0.00', '-0.00'];

export function demandKey(coating: string, lensType: string, powerKey: string): string {
  return `${coating}::${lensType}::${powerKey}`;
}

export function parseDemandKey(
  key: string
): { coating: string; lensType: string; powerKey: string } | null {
  const [coating, lensType, powerKey] = key.split('::');
  if (!coating || !lensType || powerKey === undefined) return null;
  return { coating, lensType, powerKey };
}

export function getQtyFor(item: LensStockItem, lensType: string, powerKey: string): number {
  if (lensType === 'sph' && ZERO_KEYS.includes(powerKey)) {
    return ZERO_KEYS.reduce((sum, k) => sum + (item.quantities?.sph?.[k] || 0), 0);
  }
  return item.quantities?.[lensType as LensType]?.[powerKey] || 0;
}

// Pre-computed power ranges (mirror of the LensStock page grids).
export const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -6 && n <= -0.25) || (n >= 0.25 && n <= 6);
});
const negSphInner = SPH_INNER.filter((p) => p.startsWith('-')).reverse();
const posSphInner = SPH_INNER.filter((p) => p.startsWith('+') && p !== '+0.00');

export const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});
const negCylList = CYL_RANGE.filter((p) => p.startsWith('-')).reverse();
const posCylList = CYL_RANGE.filter((p) => p.startsWith('+') && p !== '+0.00');

export type DemandTabKey = LensType | 'plain';

export const DEMAND_TABS: { key: DemandTabKey; label: string }[] = [
  { key: 'plain', label: 'Plain' },
  { key: 'sph', label: 'SPH' },
  { key: 'cyl', label: 'CYL' },
  { key: 'compound', label: 'Compound' },
];

export interface DemandViewProps {
  coating: string;
  quantities: Record<string, number>;
  demandTarget: number;
  getDemandQty: (key: string) => number;
  onToggleDemand: (key: string) => void;
  onRemoveDemand: (key: string) => void;
  disabled?: boolean;
}

// ── single-power demand cell ─────────────────────────────────────
const DemandCell = memo(function DemandCell({
  coating: _coating,
  lensType: _lensType,
  powerKey,
  qty,
  demandQty = 0,
  need = 0,
  onToggleDemand,
  onRemoveDemand,
  disabled = false,
}: {
  coating: string;
  lensType: string;
  powerKey: string;
  qty: number;
  demandQty?: number;
  need?: number;
  onToggleDemand?: () => void;
  onRemoveDemand?: () => void;
  disabled?: boolean;
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

  const selectedBorder =
    demandQty > 0
      ? 'border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20'
      : baseBorder;

  return (
    <div
      data-demand-cell
      onClick={disabled ? undefined : () => onToggleDemand?.()}
      className={`relative flex flex-col items-center gap-1.5 py-4 px-3 rounded-lg border transition-all duration-150 ${selectedBorder} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {demandQty > 0 && !disabled && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveDemand?.();
          }}
          className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center cursor-pointer active:scale-90 z-10"
          title="Remove from demand"
        >
          <span className="text-micro font-bold leading-none">{fmtP(demandQty)}</span>
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5 w-full pointer-events-none">
        <span className="text-body-bold text-th-secondary leading-none">{powerLabel}</span>
        <span
          className={`text-feature leading-none ${isNeg ? 'text-amber-500' : isPos ? 'text-emerald-500' : 'text-th-muted'}`}
        >
          {fmtPairs(qty)}
        </span>
        {need > 0 && demandQty === 0 && !disabled && (
          <span className="text-micro font-bold text-warning leading-none">need {fmtP(need)}</span>
        )}
        {demandQty > 0 && (
          <span className="text-micro font-bold text-primary-500 leading-none">
            +{fmtP(demandQty)}
          </span>
        )}
      </div>
    </div>
  );
});

// ── compound (SPH|CYL) demand cell ──────────────────────────────
const DemandCompoundCell = memo(function DemandCompoundCell({
  powerKey,
  qty,
  demandQty = 0,
  need = 0,
  onToggleDemand,
  onRemoveDemand,
  disabled = false,
}: {
  powerKey: string;
  qty: number;
  demandQty?: number;
  need?: number;
  onToggleDemand?: () => void;
  onRemoveDemand?: () => void;
  disabled?: boolean;
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

  const selectedBorder =
    demandQty > 0
      ? 'border-primary-500/70 bg-primary-500/15 ring-1 ring-primary-500/20'
      : baseBorder;

  return (
    <div
      data-demand-cell
      onClick={disabled ? undefined : () => onToggleDemand?.()}
      className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all duration-150 ${selectedBorder} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {demandQty > 0 && !disabled && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveDemand?.();
          }}
          className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center cursor-pointer active:scale-90 z-10"
          title="Remove from demand"
        >
          <span className="text-micro font-bold leading-none">{fmtP(demandQty)}</span>
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5 w-full pointer-events-none">
        <span className="text-body-bold leading-none whitespace-nowrap">
          <span
            className={sphNeg ? 'text-amber-500' : sphPos ? 'text-emerald-500' : 'text-th-secondary'}
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
        {need > 0 && demandQty === 0 && !disabled && (
          <span className="text-micro font-bold text-warning leading-none">need {fmtP(need)}</span>
        )}
        {demandQty > 0 && (
          <span className="text-micro font-bold text-primary-500 leading-none">
            +{fmtP(demandQty)}
          </span>
        )}
      </div>
    </div>
  );
});

// ── plain view ───────────────────────────────────────────────────
export const DemandPlainView = memo(function DemandPlainView({
  coating,
  quantities,
  demandTarget,
  getDemandQty,
  onToggleDemand,
  onRemoveDemand,
  disabled = false,
}: DemandViewProps) {
  const powerKey = '+0.00';
  const qty = ZERO_KEYS.reduce((sum, k) => sum + (quantities[k] || 0), 0);
  const dKey = demandKey(coating, 'sph', powerKey);
  const need = Math.max(0, roundHalf(demandTarget - qty / 2));
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 mt-2">
      <DemandCell
        coating={coating}
        lensType="sph"
        powerKey={powerKey}
        qty={qty}
        demandQty={getDemandQty(dKey)}
        need={need}
        onToggleDemand={() => onToggleDemand(dKey)}
        onRemoveDemand={() => onRemoveDemand(dKey)}
        disabled={disabled}
      />
    </div>
  );
});

// ── SPH / CYL flat grid ─────────────────────────────────────────
export const DemandFlatGrid = memo(function DemandFlatGrid({
  coating,
  quantities,
  lensType,
  demandTarget,
  getDemandQty,
  onToggleDemand,
  onRemoveDemand,
  disabled = false,
}: DemandViewProps & { lensType: LensType }) {
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
                  const dKey = demandKey(coating, lensType, power);
                  const need = Math.max(0, roundHalf(demandTarget - qty / 2));
                  return (
                    <DemandCell
                      key={power}
                      coating={coating}
                      lensType={lensType}
                      powerKey={power}
                      qty={qty}
                      demandQty={getDemandQty(dKey)}
                      need={need}
                      onToggleDemand={() => onToggleDemand(dKey)}
                      onRemoveDemand={() => onRemoveDemand(dKey)}
                      disabled={disabled}
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

// ── compound view ────────────────────────────────────────────────
export const DemandCompoundView = memo(function DemandCompoundView({
  coating,
  quantities,
  demandTarget,
  getDemandQty,
  onToggleDemand,
  onRemoveDemand,
  disabled = false,
}: DemandViewProps) {
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
                                  const dKey = demandKey(coating, 'compound', key);
                                  const need = Math.max(0, roundHalf(demandTarget - qty / 2));
                                  return (
                                    <DemandCompoundCell
                                      key={key}
                                      powerKey={key}
                                      qty={qty}
                                      demandQty={getDemandQty(dKey)}
                                      need={need}
                                      onToggleDemand={() => onToggleDemand(dKey)}
                                      onRemoveDemand={() => onRemoveDemand(dKey)}
                                      disabled={disabled}
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