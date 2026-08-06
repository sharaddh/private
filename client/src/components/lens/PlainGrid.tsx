import { ShoppingCart, X } from "lucide-react";
import { ZERO_KEYS } from "./powers";

interface Props {
  quantities: Record<string, number>;
  onIncrement?: (powerKey: string) => void;
  onDecrement?: (powerKey: string) => void;
  onAddToCart?: (powerKey: string) => void;
  onRemoveFromCart?: (powerKey: string) => void;
  clickToAdd?: boolean;
  clickTitle?: string;
  cartQty?: number;
}

export default function PlainGrid({ quantities, onIncrement, onDecrement, onAddToCart, onRemoveFromCart, clickToAdd, clickTitle, cartQty }: Props) {
  const qty = ZERO_KEYS.reduce((sum, k) => sum + (quantities[k] || 0), 0);
  const editable = Boolean(onIncrement || onDecrement);

  const cardBase = "flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border border-th-border bg-th-elevated";
  const label = <span className="text-sm sm:text-base font-bold text-th-secondary leading-none">0.00</span>;
  const qtyEl = <span className={`text-lg sm:text-xl font-bold leading-none ${qty > 0 ? "text-th-secondary" : "text-th-muted"}`}>{qty}</span>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2">
      {clickToAdd ? (
        (() => {
          const maxed = qty <= 0 || (cartQty || 0) >= qty;
          return (
            <div
              role="button"
              tabIndex={maxed ? -1 : 0}
              onClick={maxed ? undefined : () => onAddToCart?.("+0.00")}
              onKeyDown={maxed ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddToCart?.("+0.00"); } }}
              aria-disabled={maxed}
              title={clickTitle || "Add to cart"}
              className={`${cardBase} relative transition-all ${
                maxed
                  ? "opacity-45 cursor-not-allowed"
                  : "cursor-pointer hover:border-primary-500/60 hover:ring-1 hover:ring-primary-500/25 active:scale-95 group"
              }`}
            >
              {(cartQty || 0) > 0 && (
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveFromCart?.("+0.00"); }}
                  className="absolute top-1 right-1 flex items-center px-1.5 py-0.5 rounded-full bg-th-elevated text-th-muted hover:text-negative hover:bg-negative/10 transition-colors"
                  aria-label="Deselect plain"
                  title="Deselect"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              )}
              {label}
              {qtyEl}
            </div>
          );
        })()
      ) : (
        <div className={cardBase}>
          {label}
          {qtyEl}
          {editable ? (
          <div className="flex items-center gap-2">
            {onDecrement && (
              <button type="button"
                onClick={() => onDecrement("+0.00")}
                className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all"
                aria-label="Decrement plain"
              >
                <span className="text-lg font-bold leading-none">−</span>
              </button>
            )}
            {onAddToCart && (
              <button type="button"
                onClick={() => onAddToCart("+0.00")}
                className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center active:scale-90 active:bg-primary-500/20 transition-all"
                aria-label="Add plain to cart"
                title="Add to cart"
              >
                <ShoppingCart size={16} />
              </button>
            )}
            {onIncrement && (
              <button type="button"
                onClick={() => onIncrement("+0.00")}
                className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 active:bg-emerald-500/20 transition-all"
                aria-label="Increment plain"
              >
                <span className="text-lg font-bold leading-none">+</span>
              </button>
            )}
          </div>
        ) : onAddToCart ? (
          <button type="button"
            onClick={() => onAddToCart("+0.00")}
            className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center active:scale-90 active:bg-primary-500/20 transition-all"
            aria-label="Add plain to cart"
            title="Add to cart"
          >
            <ShoppingCart size={16} />
          </button>
        ) : null}
        </div>
      )}
    </div>
  );
}
