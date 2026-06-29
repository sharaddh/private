import { useState } from "react";
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
  const [activePreset, setActivePreset] = useState("");

  function applyPreset(preset: typeof presets[0]) {
    setActivePreset(preset.label);
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
    setActivePreset("");
    if (e <= today) onChange(format(s), format(e));
    else {
      onChange(format(s), format(today));
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => {
          const isActive = activePreset === p.label;
          return (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-sm ${
                isActive
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-800 dark:hover:text-gray-200"
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => shift(-1)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700">
          <ChevronLeft size={15} />
        </button>
        <input type="date" value={startDate} onChange={(e) => { setActivePreset(""); onChange(e.target.value, endDate); }}
          className="text-xs font-medium py-2 pl-2.5 pr-1.5 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400/60 transition-all w-32 hover:border-gray-300 dark:hover:border-dark-500 cursor-pointer shadow-sm" />
        <span className="text-xs font-medium text-gray-400">—</span>
        <input type="date" value={endDate} onChange={(e) => { setActivePreset(""); onChange(startDate, e.target.value); }}
          className="text-xs font-medium py-2 pl-2.5 pr-1.5 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400/60 transition-all w-32 hover:border-gray-300 dark:hover:border-dark-500 cursor-pointer shadow-sm" />
        <button onClick={() => shift(1)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700">
          <ChevronRight size={15} />
        </button>
      </div>
      {count !== undefined && (
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-auto px-4 py-2 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-sm">
          {count} {label}{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
