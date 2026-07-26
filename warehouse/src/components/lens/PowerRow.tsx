import { useState } from "react";
import { POWER_VALUES } from "../../constants";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

export default function PowerRow({ quantities, onIncrement, onDecrement }: Props) {
  const negatives = POWER_VALUES.filter((p) => p.startsWith("-")).reverse();
  const positives = POWER_VALUES.filter((p) => p.startsWith("+"));
  const hasZero = POWER_VALUES.some((p) => p === "+0.00" || p === "0.00");

  const [openGroup, setOpenGroup] = useState<string>("Negative");

  function renderCell(power: string) {
    const qty = quantities[power] || 0;
    const isNeg = power.startsWith("-");
    const isPos = power.startsWith("+") && power !== "+0.00";
    const isZero = power === "+0.00" || power === "0.00";

    const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
    const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
    const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

    return (
      <div key={power} className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border ${border} ${bg}`}>
        <span className="text-xs sm:text-sm font-bold text-th-secondary leading-none">{isZero ? "0.00" : power}</span>
        <span className={`text-base sm:text-lg font-bold leading-none ${qtyClr}`}>{qty}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onDecrement(power)}
            className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all"
          >
            <Minus size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onIncrement(power)}
            className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  function toggle(label: string) {
    setOpenGroup((prev) => (prev === label ? "" : label));
  }

  return (
    <div className="space-y-1.5">
      {negatives.length > 0 && (
        <div>
          <button
            onClick={() => toggle("Negative")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg active:bg-th-elevated transition-colors"
          >
            {openGroup === "Negative" ? <ChevronDown size={16} className="text-amber-500" /> : <ChevronRight size={16} className="text-amber-500" />}
            <span className="px-2.5 py-0.5 rounded-pill bg-amber-500/10 text-amber-500 text-xs font-bold">NEGATIVE</span>
            <span className="text-xs text-th-muted">({negatives.length})</span>
          </button>
          {openGroup === "Negative" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 mt-1 ml-4">
              {negatives.map((p) => renderCell(p))}
            </div>
          )}
        </div>
      )}

      {hasZero && (
        <div>
          <button
            onClick={() => toggle("Zero")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg active:bg-th-elevated transition-colors"
          >
            {openGroup === "Zero" ? <ChevronDown size={16} className="text-th-muted" /> : <ChevronRight size={16} className="text-th-muted" />}
            <span className="px-2.5 py-0.5 rounded-pill bg-th-elevated text-th-secondary text-xs font-bold">ZERO</span>
          </button>
          {openGroup === "Zero" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 mt-1 ml-4">
              {renderCell("+0.00")}
            </div>
          )}
        </div>
      )}

      {positives.length > 0 && (
        <div>
          <button
            onClick={() => toggle("Positive")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg active:bg-th-elevated transition-colors"
          >
            {openGroup === "Positive" ? <ChevronDown size={16} className="text-emerald-500" /> : <ChevronRight size={16} className="text-emerald-500" />}
            <span className="px-2.5 py-0.5 rounded-pill bg-emerald-500/10 text-emerald-500 text-xs font-bold">POSITIVE</span>
            <span className="text-xs text-th-muted">({positives.length})</span>
          </button>
          {openGroup === "Positive" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 mt-1 ml-4">
              {positives.map((p) => renderCell(p))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
