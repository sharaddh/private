import { useState, memo } from "react";
import { POWER_VALUES } from "../../constants";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
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

const SphCell = memo(function SphCell({ sph, qty, onIncrement, onDecrement }: {
  sph: string;
  qty: number;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
}) {
  const isNeg = sph.startsWith("-");
  const isPos = sph.startsWith("+") && sph !== "+0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  return (
    <div className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border ${border} ${bg}`}>
      <span className="text-xs sm:text-sm font-bold text-th-secondary leading-none">{sph}</span>
      <span className={`text-base sm:text-lg font-bold leading-none ${qtyClr}`}>{qty}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onDecrement(sph)} className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all">
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button onClick={() => onIncrement(sph)} className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

export default function CompoundGrid({ quantities, onIncrement, onDecrement }: Props) {
  const [openCyl, setOpenCyl] = useState<string>("");

  const wrappedIncrement = (sph: string, cyl: string) => onIncrement(`${sph}|${cyl}`);
  const wrappedDecrement = (sph: string, cyl: string) => onDecrement(`${sph}|${cyl}`);

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
            <div className="text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">{group.label}</div>
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
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg active:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={16} className="text-th-muted" /> : <ChevronRight size={16} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylColor} text-xs font-bold`}>CYL {cyl}</span>
                      <span className="text-xs text-primary-500 font-medium">{sphStockCount} in stock</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-5 space-y-3">
                        {sphInnerGroups.map((sphGroup) => (
                          <div key={sphGroup.label}>
                            <div className="text-xs font-bold uppercase tracking-wider mb-1.5 px-1 text-th-muted">{sphGroup.label}</div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                              {sphGroup.values.map((sph) => {
                                const key = `${sph}|${cyl}`;
                                const qty = quantities[key] || 0;
                                return (
                                  <SphCell
                                    key={sph}
                                    sph={sph}
                                    qty={qty}
                                    onIncrement={() => wrappedIncrement(sph, cyl)}
                                    onDecrement={() => wrappedDecrement(sph, cyl)}
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
