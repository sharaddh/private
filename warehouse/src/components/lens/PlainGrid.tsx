import { memo } from "react";
import { Minus, Plus } from "lucide-react";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

const ZERO_KEYS = ["+0.00", "0.00", "-0.00"];

const PlainGrid = memo(function PlainGrid({ quantities, onIncrement, onDecrement }: Props) {
  const qty = ZERO_KEYS.reduce((sum, k) => sum + (quantities[k] || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
      <div className="flex flex-col items-center gap-2.5 p-3 rounded-xl border border-th-border bg-th-elevated">
        <span className="text-sm sm:text-base font-bold text-th-secondary leading-none">0.00</span>
        <span className={`text-lg sm:text-xl font-bold leading-none ${qty > 0 ? "text-th-secondary" : "text-th-muted"}`}>{qty}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDecrement("+0.00")}
            className="w-12 h-12 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all"
          >
            <Minus size={22} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onIncrement("+0.00")}
            className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default PlainGrid;
