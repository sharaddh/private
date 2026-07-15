import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-muted" />
      <input type="text" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field pl-9 pr-8" />
      {value && (
        <button onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
