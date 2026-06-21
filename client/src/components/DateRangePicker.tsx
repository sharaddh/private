import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function fmt(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function range(label: string, start: Date, end: Date): Preset {
  return { label, start: fmt(start), end: fmt(end) };
}

interface Preset {
  label: string;
  start: string;
  end: string;
}

const presets: Preset[] = [
  { label: "Today", start: fmt(new Date()), end: fmt(new Date()) },
  range("Yesterday", new Date(Date.now() - 86400000), new Date(Date.now() - 86400000)),
  range("This Week", (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; })(), new Date()),
  range("This Month", (() => { const d = new Date(); d.setDate(1); return d; })(), new Date()),
  range("Last Month", (() => { const d = new Date(); d.setMonth(d.getMonth() - 1, 1); return d; })(), (() => { const d = new Date(); d.setDate(0); return d; })()),
  { label: "All", start: "2000-01-01", end: fmt(new Date()) },
];

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  count: number;
  label: string;
}

export default function DateRangePicker({ startDate, endDate, onChange, count, label }: Props) {
  const activePreset = useMemo(() => {
    return presets.find((p) => p.start === startDate && p.end === endDate) || null;
  }, [startDate, endDate]);

  function selectPreset(p: Preset) {
    onChange(p.start, p.end);
  }

  function goMonth(delta: number) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    s.setMonth(s.getMonth() + delta);
    e.setMonth(e.getMonth() + delta);
    onChange(fmt(s), fmt(e));
  }

  return (
    <div className="flex items-center gap-4 flex-wrap bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => {
          const active = activePreset?.label === p.label;
          return (
            <button key={p.label} onClick={() => selectPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                active
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-300"
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={() => goMonth(-1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all">
          <ChevronLeft size={14} />
        </button>
        <div className="relative">
          <div className="flex items-center gap-0">
            <div className="relative">
              <input type="date" value={startDate} onChange={(e) => onChange(e.target.value, endDate)}
                className="form-input text-xs py-1.5 pl-2 pr-1.5 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all w-28 hover:border-gray-300 dark:hover:border-dark-600 cursor-pointer" />
            </div>
            <span className="mx-1 text-gray-300 dark:text-gray-600 text-xs font-medium">—</span>
            <div className="relative">
              <input type="date" value={endDate} onChange={(e) => onChange(startDate, e.target.value)}
                className="form-input text-xs py-1.5 pl-2 pr-1.5 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all w-28 hover:border-gray-300 dark:hover:border-dark-600 cursor-pointer" />
            </div>
          </div>
        </div>
        <button onClick={() => goMonth(1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all">
          <ChevronRight size={14} />
        </button>
      </div>

      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-auto px-3 py-1.5 bg-gray-50 dark:bg-dark-850 rounded-lg border border-gray-100 dark:border-dark-700">
        {count} {label}{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
