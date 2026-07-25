import { POWER_VALUES } from "../../constants";

interface Props {
  quantities: Record<string, number>;
  onIncrement: (powerKey: string) => void;
  onDecrement: (powerKey: string) => void;
}

export default function PowerRow({ quantities, onIncrement, onDecrement }: Props) {
  const negatives = POWER_VALUES.filter((p) => p.startsWith("-")).reverse();
  const positives = POWER_VALUES.filter((p) => p.startsWith("+"));
  const hasZero = POWER_VALUES.some((p) => p === "+0.00" || p === "0.00");

  function renderCell(power: string) {
    const qty = quantities[power] || 0;
    const hasStock = qty > 0;
    const isZero = power === "+0.00" || power === "-0.00" || power === "0.00";
    return (
      <div
        key={power}
        className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-md border transition-all ${
          hasStock
            ? "border-primary-500/30 bg-primary-500/8"
            : isZero
            ? "border-th-border bg-th-elevated"
            : "border-th-border hover:border-th-border-med hover:bg-th-elevated"
        }`}
      >
        <span className="text-micro font-bold text-th-secondary leading-none">{isZero ? "0.00" : power}</span>
        <span className={`text-body-bold leading-none ${hasStock ? "text-primary-500" : "text-th-muted"}`}>
          {qty}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onDecrement(power)}
            className="w-6 h-6 rounded bg-negative/15 text-negative flex items-center justify-center text-small-bold hover:bg-negative/25 active:scale-90 transition-all"
          >
            -
          </button>
          <button
            onClick={() => onIncrement(power)}
            className="w-6 h-6 rounded bg-primary-500/15 text-primary-500 flex items-center justify-center text-small-bold hover:bg-primary-500/25 active:scale-90 transition-all"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {negatives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2.5 py-0.5 rounded-pill bg-negative/10 text-negative text-micro font-bold">
              NEGATIVE
            </span>
            <span className="text-micro text-th-muted">({negatives.length} powers)</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
            {negatives.map((p) => renderCell(p))}
          </div>
        </div>
      )}

      {hasZero && (
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-pill bg-th-elevated text-th-secondary text-micro font-bold mb-2">
            ZERO
          </span>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
            {renderCell("+0.00")}
          </div>
        </div>
      )}

      {positives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2.5 py-0.5 rounded-pill bg-primary-500/10 text-primary-500 text-micro font-bold">
              POSITIVE
            </span>
            <span className="text-micro text-th-muted">({positives.length} powers)</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
            {positives.map((p) => renderCell(p))}
          </div>
        </div>
      )}
    </div>
  );
}
