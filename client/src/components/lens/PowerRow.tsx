import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NEGATIVE_POWERS, POSITIVE_POWERS } from "./powers";
import PowerCell from "./PowerCell";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

export default function PowerRow({ quantities, onIncrement, onDecrement }: Props) {
  const [openGroup, setOpenGroup] = useState<string>("Negative");

  function toggle(label: string) {
    setOpenGroup((prev) => (prev === label ? "" : label));
  }

  return (
    <div className="space-y-2">
      <div>
        <button
          onClick={() => toggle("Negative")}
          className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
        >
          {openGroup === "Negative" ? <ChevronDown size={20} className="text-amber-500" /> : <ChevronRight size={20} className="text-amber-500" />}
          <span className="px-2.5 py-0.5 rounded-pill bg-amber-500/10 text-amber-500 text-body font-bold">NEGATIVE</span>
          <span className="text-body text-th-muted">({NEGATIVE_POWERS.length})</span>
        </button>
        {openGroup === "Negative" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
            {NEGATIVE_POWERS.map((p) => (
              <PowerCell key={p} power={p} qty={quantities[p] || 0} onIncrement={onIncrement} onDecrement={onDecrement} />
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => toggle("Positive")}
          className="flex items-center gap-2 w-full px-2.5 py-3 rounded-lg active:bg-th-elevated transition-colors"
        >
          {openGroup === "Positive" ? <ChevronDown size={20} className="text-emerald-500" /> : <ChevronRight size={20} className="text-emerald-500" />}
          <span className="px-2.5 py-0.5 rounded-pill bg-emerald-500/10 text-emerald-500 text-body font-bold">POSITIVE</span>
          <span className="text-body text-th-muted">({POSITIVE_POWERS.length})</span>
        </button>
        {openGroup === "Positive" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
            {POSITIVE_POWERS.map((p) => (
              <PowerCell key={p} power={p} qty={quantities[p] || 0} onIncrement={onIncrement} onDecrement={onDecrement} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
