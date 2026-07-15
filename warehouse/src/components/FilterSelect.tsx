interface Props {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export default function FilterSelect({ value, onChange, options, className = "" }: Props) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`input-field w-auto ${className}`}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
