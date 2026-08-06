import { ClipboardList, Download, Minus, Plus } from "lucide-react";

interface Props {
  demandSelSize: number;
  totalNeed: number;
  totalAmount: number;
  target: number;
  onSetTarget: (value: number) => void;
  onAllLowStock: () => void;
  onClear: () => void;
  onDownload: () => void;
}

export default function LensDemandBar({ demandSelSize, totalNeed, totalAmount, target, onSetTarget, onAllLowStock, onClear, onDownload }: Props) {
  return (
    <div className="sticky bottom-[72px] lg:bottom-2 z-20">
      <div className="bg-th-surface border border-th-border rounded-xl px-3.5 py-3 shadow-lifted flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-small-bold text-th-secondary">Fill each power up to</span>
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={() => onSetTarget(Math.max(1, target - 1))}
              className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Decrease target"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => onSetTarget(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 h-8 text-center text-small-bold bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
              aria-label="Target stock level"
            />
            <button type="button"
              onClick={() => onSetTarget(target + 1)}
              className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Increase target"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList size={18} className="text-primary-500 shrink-0" />
            <span className="text-small-bold text-th-text">
              {demandSelSize} lens{demandSelSize !== 1 ? "es" : ""} selected
            </span>
            <span className="text-small text-th-muted hidden md:inline">·</span>
            <span className="text-small text-th-secondary hidden md:inline">
              <span className="text-primary-500 font-bold">{totalNeed}</span> pcs to buy
            </span>
            <span className="text-small text-th-secondary hidden lg:inline">
              · <span className="text-primary-500 font-bold">₹{totalAmount.toLocaleString("en-IN")}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            <button type="button"
              onClick={onAllLowStock}
              className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-th-text text-small-bold border border-th-border"
            >
              All low stock
            </button>
            <button type="button"
              onClick={onClear}
              disabled={demandSelSize === 0}
              className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-negative text-small-bold border border-th-border disabled:opacity-40"
            >
              Clear
            </button>
            <button type="button"
              onClick={onDownload}
              disabled={demandSelSize === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
