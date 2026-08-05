interface Props {
  power: string;
  qty: number;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

export default function PowerCell({ power, qty, onIncrement, onDecrement }: Props) {
  const isNeg = power.startsWith("-");
  const isPos = power.startsWith("+") && power !== "+0.00";
  const isZero = power === "+0.00" || power === "0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  return (
    <div className={`flex flex-col items-center gap-2.5 p-3 rounded-xl border ${border} ${bg}`}>
      <span className="text-sm sm:text-base font-bold text-th-secondary leading-none">{isZero ? "0.00" : power}</span>
      <span className={`text-lg sm:text-xl font-bold leading-none ${qtyClr}`}>{qty}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDecrement(power)}
          className="w-12 h-12 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all"
          aria-label={`Decrement ${power}`}
        >
          <span className="text-xl font-bold leading-none">−</span>
        </button>
        <button
          onClick={() => onIncrement(power)}
          className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all"
          aria-label={`Increment ${power}`}
        >
          <span className="text-xl font-bold leading-none">+</span>
        </button>
      </div>
    </div>
  );
}
