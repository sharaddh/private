import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  count?: number;
  label?: string;
}

const presets = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "This Week", days: null },
  { label: "This Month", days: null },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
];

function format(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function DateRangePicker({ startDate, endDate, onChange, count, label = "record" }: DateRangePickerProps) {
  const today = new Date();

  function applyPreset(preset: typeof presets[0]) {
    if (preset.days !== null) {
      const s = new Date(today);
      s.setDate(s.getDate() - preset.days);
      onChange(format(s), format(today));
    } else if (preset.label === "This Week") {
      const s = new Date(today);
      const day = s.getDay();
      s.setDate(s.getDate() - (day === 0 ? 6 : day - 1));
      onChange(format(s), format(today));
    } else if (preset.label === "This Month") {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      onChange(format(s), format(today));
    }
  }

  function shift(d: number) {
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const s = new Date(startDate);
    s.setDate(s.getDate() + d);
    const e = new Date(endDate);
    e.setDate(e.getDate() + d);
    if (e <= today) onChange(format(s), format(e));
    else {
      onChange(format(s), format(today));
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all duration-200 text-muted-500 dark:text-muted-400 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm border border-surface-200/50 dark:border-dark-600/30 hover:bg-white/80 dark:hover:bg-dark-700/80 hover:text-muted-700 dark:hover:text-muted-300">
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => shift(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-400 hover:text-muted-600 dark:hover:text-muted-300 hover:bg-surface-100/60 dark:hover:bg-dark-700/60 transition-all">
          <ChevronLeft size={14} />
        </button>
        <input type="date" value={startDate} onChange={(e) => onChange(e.target.value, endDate)}
          className="text-xs py-1.5 pl-2 pr-1 rounded-lg border border-surface-200/50 dark:border-dark-600/30 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm text-muted-800 dark:text-muted-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400/60 transition-all w-28 hover:border-surface-300 dark:hover:border-dark-500 cursor-pointer" />
        <span className="text-xs text-muted-400">—</span>
        <input type="date" value={endDate} onChange={(e) => onChange(startDate, e.target.value)}
          className="text-xs py-1.5 pl-2 pr-1 rounded-lg border border-surface-200/50 dark:border-dark-600/30 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm text-muted-800 dark:text-muted-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400/60 transition-all w-28 hover:border-surface-300 dark:hover:border-dark-500 cursor-pointer" />
        <button onClick={() => shift(1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-400 hover:text-muted-600 dark:hover:text-muted-300 hover:bg-surface-100/60 dark:hover:bg-dark-700/60 transition-all">
          <ChevronRight size={14} />
        </button>
      </div>
      {count !== undefined && (
        <span className="text-xs font-medium text-muted-400 dark:text-muted-500 ml-auto px-3 py-1.5 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm rounded-lg border border-surface-200/50 dark:border-dark-600/30">
          {count} {label}{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
