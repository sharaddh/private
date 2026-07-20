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
              className={`text-[17px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                isActive
                  ? "bg-[#1ed760] text-black"
                  : "text-th-secondary bg-th-elevated hover:bg-th-hover"
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => shift(-1)} aria-label="Previous period" className="w-7 h-7 rounded-[9999px] flex items-center justify-center text-th-secondary hover:text-th-text hover:bg-th-elevated transition-all duration-200 bg-th-elevated">
          <ChevronLeft size={14} />
        </button>
        <input type="date" value={startDate} onChange={(e) => { onChange(e.target.value, endDate); }}
          className="text-[17px] font-medium py-1.5 pl-2 pr-1 rounded-lg bg-th-elevated text-th-text focus:border-[#1ed760] transition-all duration-200 w-28 hover:border-[#b3b3b3] cursor-pointer"
          style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }} />
        <span className="text-[17px] font-medium text-th-secondary">—</span>
        <input type="date" value={endDate} onChange={(e) => { onChange(startDate, e.target.value); }}
          className="text-[17px] font-medium py-1.5 pl-2 pr-1 rounded-lg bg-th-elevated text-th-text focus:border-[#1ed760] transition-all duration-200 w-28 hover:border-[#b3b3b3] cursor-pointer"
          style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }} />
        <button onClick={() => shift(1)} aria-label="Next period" className="w-7 h-7 rounded-[9999px] flex items-center justify-center text-th-secondary hover:text-th-text hover:bg-th-elevated transition-all duration-200 bg-th-elevated">
          <ChevronRight size={14} />
        </button>
      </div>
      {count !== undefined && (
        <span className="text-[17px] font-medium text-th-secondary ml-auto px-3 py-1.5 bg-th-elevated rounded-lg">
          {count} {label}{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
