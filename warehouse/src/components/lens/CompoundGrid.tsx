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
const posCylList = CYL_RANGE.filter((p) => p.startsWith("+") && p !== "+0.00");

const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -6 && n <= -0.25) || (n >= 0.25 && n <= 6);
});
const negSphInner = SPH_INNER.filter((p) => p.startsWith("-")).reverse();
const posSphInner = SPH_INNER.filter((p) => p.startsWith("+") && p !== "+0.00");

const SphCell = memo(function SphCell({ sph, cyl, qty, onIncrement, onDecrement }: {
  sph: string;
  cyl: string;
  qty: number;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
}) {
  const isNeg = sph.startsWith("-");
  const isPos = sph.startsWith("+") && sph !== "+0.00";
  const isZero = sph === "+0.00" || sph === "0.00" || sph === "-0.00";
  const sphLabel = isZero ? "0.00" : sph;
  const cylLabel = cyl === "+0.00" || cyl === "0.00" || cyl === "-0.00" ? "0.00" : cyl;
  const cylNeg = cyl.startsWith("-");
  const cylPos = cyl.startsWith("+") && cyl !== "+0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  return (
    <div className={`flex flex-col items-center gap-2.5 p-3 rounded-xl border ${border} ${bg}`}>
      <span className="text-sm sm:text-base font-bold leading-none whitespace-nowrap">
        <span className={isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-secondary"}>{sphLabel}</span>
        <span className="text-th-muted"> | </span>
        <span className={cylNeg ? "text-amber-500" : cylPos ? "text-emerald-500" : "text-th-muted"}>{cylLabel}</span>
      </span>
      <span className={`text-lg sm:text-xl font-bold leading-none ${qtyClr}`}>{qty}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onDecrement(sph)} className="w-12 h-12 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all">
          <Minus size={22} strokeWidth={2.5} />
        </button>
        <button onClick={() => onIncrement(sph)} className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all">
          <Plus size={22} strokeWidth={2.5} />
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
            <div className="text-body font-bold uppercase tracking-wider mb-2 ml-1">{group.label}</div>
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
                      className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
                    >
                      {isOpen ? <ChevronDown size={20} className="text-th-muted" /> : <ChevronRight size={20} className="text-th-muted" />}
                      <span className={`px-2.5 py-0.5 rounded-pill ${cylBg} ${cylColor} text-body font-bold`}>CYL {cyl}</span>
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
                                return (
                                  <SphCell
                                    key={sph}
                                    sph={sph}
                                    cyl={cyl}
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
