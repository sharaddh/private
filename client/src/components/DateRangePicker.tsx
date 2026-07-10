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

  function isActivePreset(preset: typeof presets[0]): boolean {
    if (preset.days !== null) {
      const s = new Date(today);
      s.setDate(s.getDate() - preset.days);
      return startDate === format(s) && endDate === format(today);
    }
    if (preset.label === "This Week") {
      const s = new Date(today);
      const day = s.getDay();
      s.setDate(s.getDate() - (day === 0 ? 6 : day - 1));
      return startDate === format(s) && endDate === format(today);
    }
    if (preset.label === "This Month") {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return startDate === format(s) && endDate === format(today);
    }
    return false;
  }

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
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => {
          const isActive = isActivePreset(p);
          return (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => shift(-1)} aria-label="Previous period" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-sm">
          <ChevronLeft size={14} />
        </button>
        <input type="date" value={startDate} onChange={(e) => { onChange(e.target.value, endDate); }}
          className="text-xs font-medium py-1.5 pl-2 pr-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 w-28 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer shadow-sm" />
        <span className="text-xs font-medium text-slate-400">—</span>
        <input type="date" value={endDate} onChange={(e) => { onChange(startDate, e.target.value); }}
          className="text-xs font-medium py-1.5 pl-2 pr-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 w-28 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer shadow-sm" />
        <button onClick={() => shift(1)} aria-label="Next period" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-sm">
          <ChevronRight size={14} />
        </button>
      </div>
      {count !== undefined && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-auto px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm">
          {count} {label}{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
