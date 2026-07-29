import { useState, memo } from "react";
import { POWER_VALUES } from "../../constants";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
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

const CompoundCell = memo(function CompoundCell({ cyl, qty, onIncrement, onDecrement }: {
  cyl: string;
  qty: number;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
}) {
  const isNeg = cyl.startsWith("-");
  const isPos = cyl.startsWith("+") && cyl !== "+0.00";
  const isZero = cyl === "+0.00" || cyl === "0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  return (
    <div className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border ${border} ${bg}`}>
      <span className="text-xs sm:text-sm font-bold text-th-secondary leading-none">{isZero ? "0.00" : cyl}</span>
      <span className={`text-base sm:text-lg font-bold leading-none ${qtyClr}`}>{qty}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onDecrement(cyl)} className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all">
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button onClick={() => onIncrement(cyl)} className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

export default function CompoundGrid({ quantities, onIncrement, onDecrement }: Props) {
  const [openSph, setOpenSph] = useState<string>("");

  const wrappedIncrement = (sph: string, cyl: string) => onIncrement(`${sph}|${cyl}`);
  const wrappedDecrement = (sph: string, cyl: string) => onDecrement(`${sph}|${cyl}`);

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
            <div className="text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">{group.label}</div>
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
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg active:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={16} className="text-th-muted" /> : <ChevronRight size={16} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${sphBg} ${sphColor} text-xs font-bold`}>SPH {sph}</span>
                      <span className="text-xs text-primary-500 font-medium">{cylStockCount} in stock</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                        {CYL_RANGE.map((cyl) => {
                          const key = `${sph}|${cyl}`;
                          const qty = quantities[key] || 0;
                          return (
                            <CompoundCell
                              key={cyl}
                              cyl={cyl}
                              qty={qty}
                              onIncrement={() => wrappedIncrement(sph, cyl)}
                              onDecrement={() => wrappedDecrement(sph, cyl)}
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
}
