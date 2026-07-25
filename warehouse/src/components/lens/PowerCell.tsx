interface Props {
  power: string;
  quantity: number;
  onIncrement: (power: string) => void;
  onDecrement: (power: string) => void;
}

export default function PowerCell({ power, quantity, onIncrement, onDecrement }: Props) {
  const isZero = power === "+0.00" || power === "-0.00" || power === "0.00";

  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className={`text-small font-semibold ${isZero ? "text-th-secondary" : "text-th-text"}`}>
        {isZero ? "0.00" : power}
      </span>
      <span className={`text-body-bold ${quantity > 0 ? "text-primary-500" : "text-th-muted"}`}>
        {quantity}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onDecrement(power)}
          className="w-6 h-6 rounded-full bg-negative/20 text-negative flex items-center justify-center text-small-bold hover:bg-negative/30 transition-colors"
        >
          -
        </button>
        <button
          onClick={() => onIncrement(power)}
          className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-500 flex items-center justify-center text-small-bold hover:bg-primary-500/30 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
