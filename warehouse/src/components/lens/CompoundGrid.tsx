import { useState, useMemo, memo } from "react";
import { POWER_VALUES } from "../../constants";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

const negSph = POWER_VALUES.filter((p) => p.startsWith("-")).reverse();
const posSph = POWER_VALUES.filter((p) => p.startsWith("+") && p !== "+0.00");
const hasZeroSph = POWER_VALUES.some((p) => p === "+0.00" || p === "0.00");

const CompoundCell = memo(function CompoundCell({ sph, cyl, qty, onIncrement, onDecrement }: {
  sph: string;
  cyl: string;
  qty: number;
  onIncrement: (p: string) => void;
  onDecrement: (p: string) => void;
}) {
  const key = `${sph}|${cyl}`;
  const isNeg = sph.startsWith("-");
  const isPos = sph.startsWith("+") && sph !== "+0.00";
  const isZero = sph === "+0.00" || sph === "0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  return (
    <div className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border ${border} ${bg}`}>
      <span className="text-xs sm:text-sm font-bold text-th-secondary leading-none">{isZero ? "0.00" : sph}</span>
      <span className={`text-base sm:text-lg font-bold leading-none ${qtyClr}`}>{qty}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onDecrement(key)} className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all">
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button onClick={() => onIncrement(key)} className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

const CylRow = memo(function CylRow({ cyl, quantities, onIncrement, onDecrement }: {
  cyl: string;
  quantities: Record<string, number>;
  onIncrement: (p: string) => void;
  onDecrement: (p: string) => void;
}) {
  const cylNeg = cyl.startsWith("-");
  const cylLabel = cylNeg ? "text-amber-500" : cyl === "+0.00" ? "text-th-muted" : "text-emerald-500";
  const cylBg = cylNeg ? "bg-amber-500/10" : cyl === "+0.00" ? "bg-th-elevated" : "bg-emerald-500/10";

  const stockCount = useMemo(() => {
    let count = 0;
    for (const sph of POWER_VALUES) {
      if ((quantities[`${sph}|${cyl}`] || 0) > 0) count++;
    }
    return count;
  }, [cyl, quantities]);

  return (
    <div>
      <div className="flex items-center gap-2 w-full px-2 py-2">
        <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylLabel} text-xs font-bold`}>CYL {cyl}</span>
        {stockCount > 0 && <span className="text-xs text-primary-500 font-medium">{stockCount} in stock</span>}
      </div>
      <div className="mt-1 ml-4 space-y-2">
        {negSph.length > 0 && (
          <div>
            <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1 ml-1">Negative SPH</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {negSph.map((sph) => (
                <CompoundCell key={`${sph}|${cyl}`} sph={sph} cyl={cyl} qty={quantities[`${sph}|${cyl}`] || 0} onIncrement={onIncrement} onDecrement={onDecrement} />
              ))}
            </div>
          </div>
        )}
        {hasZeroSph && (
          <div>
            <div className="text-xs font-bold text-th-muted uppercase tracking-wider mb-1 ml-1">Zero</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
              <CompoundCell sph="+0.00" cyl={cyl} qty={quantities[`+0.00|${cyl}`] || 0} onIncrement={onIncrement} onDecrement={onDecrement} />
            </div>
          </div>
        )}
        {posSph.length > 0 && (
          <div>
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 ml-1">Positive SPH</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {posSph.map((sph) => (
                <CompoundCell key={`${sph}|${cyl}`} sph={sph} cyl={cyl} qty={quantities[`${sph}|${cyl}`] || 0} onIncrement={onIncrement} onDecrement={onDecrement} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default function CompoundGrid({ quantities, onIncrement, onDecrement }: Props) {
  const [openCyl, setOpenCyl] = useState<string>("");

  return (
    <div className="space-y-1.5">
      {POWER_VALUES.map((cyl) => {
        const isOpen = openCyl === cyl;
        const cylNeg = cyl.startsWith("-");
        const cylLabel = cylNeg ? "text-amber-500" : cyl === "+0.00" ? "text-th-muted" : "text-emerald-500";
        const cylBg = cylNeg ? "bg-amber-500/10" : cyl === "+0.00" ? "bg-th-elevated" : "bg-emerald-500/10";

        let count = 0;
        for (const sph of POWER_VALUES) {
          if ((quantities[`${sph}|${cyl}`] || 0) > 0) count++;
        }

        return (
          <div key={cyl}>
            <button
              onClick={() => setOpenCyl((prev) => (prev === cyl ? "" : cyl))}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-lg active:bg-th-elevated transition-colors"
            >
              {isOpen ? <ChevronDown size={16} className="text-th-muted" /> : <ChevronRight size={16} className="text-th-muted" />}
              <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylLabel} text-xs font-bold`}>CYL {cyl}</span>
              {count > 0 && <span className="text-xs text-primary-500 font-medium">{count} in stock</span>}
            </button>
            {isOpen && (
              <CylRow cyl={cyl} quantities={quantities} onIncrement={onIncrement} onDecrement={onDecrement} />
            )}
          </div>
        );
      })}
    </div>
  );
}
