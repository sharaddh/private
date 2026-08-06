import { PackagePlus, X } from "lucide-react";

interface Props {
  onDone: () => void;
}

export default function LensUpdateBar({ onDone }: Props) {
  return (
    <div className="sticky bottom-[72px] lg:bottom-2 z-20">
      <div className="bg-th-surface border border-primary-500/30 rounded-xl px-3.5 py-3 shadow-lifted flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center gap-2 text-small-bold text-th-text min-w-0">
          <PackagePlus size={18} className="text-primary-500 shrink-0" />
          <span className="truncate">Use + to add 1 piece, − to remove 1 piece</span>
        </span>
        <span className="flex-1" />
        <button type="button"
          onClick={onDone}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-th-text text-small-bold border border-th-border transition-colors"
        >
          <X size={15} />
          Done
        </button>
      </div>
    </div>
  );
}
