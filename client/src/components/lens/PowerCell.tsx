import { ShoppingCart, X } from "lucide-react";

interface Props {
  power: string;
  qty: number;
  onIncrement?: (powerKey: string) => void;
  onDecrement?: (powerKey: string) => void;
  onAddToCart?: (powerKey: string) => void;
  onRemoveFromCart?: (powerKey: string) => void;
  clickToAdd?: boolean;
  clickTitle?: string;
  cartQty?: number;
}

export default function PowerCell({ power, qty, onIncrement, onDecrement, onAddToCart, onRemoveFromCart, clickToAdd, clickTitle, cartQty }: Props) {
  const isNeg = power.startsWith("-");
  const isPos = power.startsWith("+") && power !== "+0.00";
  const isZero = power === "+0.00" || power === "0.00";

  const border = isNeg ? "border-amber-400/40" : isPos ? "border-emerald-400/40" : "border-th-border";
  const bg = isNeg ? "bg-amber-400/5" : isPos ? "bg-emerald-400/5" : "bg-th-elevated";
  const qtyClr = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : qty > 0 ? "text-th-secondary" : "text-th-muted";

  const editable = Boolean(onIncrement || onDecrement);

  const label = <span className="text-sm sm:text-base font-bold text-th-secondary leading-none">{isZero ? "0.00" : power}</span>;
  const qtyEl = <span className={`text-lg sm:text-xl font-bold leading-none ${qtyClr}`}>{qty}</span>;

  if (clickToAdd) {
    const maxed = qty <= 0 || (cartQty || 0) >= qty;
    return (
      <div
        role="button"
        tabIndex={maxed ? -1 : 0}
        onClick={maxed ? undefined : () => onAddToCart?.(power)}
        onKeyDown={maxed ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddToCart?.(power); } }}
        aria-disabled={maxed}
        title={clickTitle || "Add to cart"}
        className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border ${border} ${bg} transition-all ${
          maxed
            ? "opacity-45 cursor-not-allowed"
            : "cursor-pointer hover:border-primary-500/60 hover:ring-1 hover:ring-primary-500/25 active:scale-95 group"
        }`}
      >
        {(cartQty || 0) > 0 && (
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onRemoveFromCart?.(power); }}
            className="absolute top-1 right-1 flex items-center px-1.5 py-0.5 rounded-full bg-th-elevated text-th-muted hover:text-negative hover:bg-negative/10 transition-colors"
            aria-label={`Deselect ${power}`}
            title="Deselect"
          >
            <X size={11} strokeWidth={3} />
          </button>
        )}
        {label}
        {qtyEl}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2.5 p-3 rounded-xl border ${border} ${bg}`}>
      {label}
      {qtyEl}
      {editable ? (
        <div className="flex items-center gap-2">
          {onDecrement && (
            <button type="button"
              onClick={() => onDecrement(power)}
              className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all"
              aria-label={`Decrement ${power}`}
            >
              <span className="text-lg font-bold leading-none">−</span>
            </button>
          )}
          {onAddToCart && (
            <button type="button"
              onClick={() => onAddToCart(power)}
              className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center active:scale-90 active:bg-primary-500/20 transition-all"
              aria-label={`Add ${power} to cart`}
              title="Add to cart"
            >
              <ShoppingCart size={16} />
            </button>
          )}
          {onIncrement && (
            <button type="button"
              onClick={() => onIncrement(power)}
              className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all"
              aria-label={`Increment ${power}`}
            >
              <span className="text-lg font-bold leading-none">+</span>
            </button>
          )}
        </div>
      ) : onAddToCart ? (
        <button type="button"
          onClick={() => onAddToCart(power)}
          className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center active:scale-90 active:bg-primary-500/20 transition-all"
          aria-label={`Add ${power} to cart`}
          title="Add to cart"
        >
          <ShoppingCart size={16} />
        </button>
      ) : null}
    </div>
  );
}
