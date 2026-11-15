import type { SelectHTMLAttributes } from 'react';

interface CatalogSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'children'
> {
  options: string[];
  value: string;
  placeholder?: string;
}

export default function CatalogSelect({
  options,
  value,
  placeholder = 'Select',
  className = '',
  ...props
}: CatalogSelectProps) {
  const list = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <select {...props} value={value} className={className}>
      <option value="">{placeholder}</option>
      {list.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
