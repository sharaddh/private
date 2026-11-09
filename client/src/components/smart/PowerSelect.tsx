import SmartSuggestInput from './SmartSuggestInput';
import { fuzzyRankSuggestions } from '../../utils/fuzzy';

export type PowerKind = 'sph' | 'cyl' | 'axis' | 'add' | 'prism' | 'pd' | 'va';

function formatPower(value: number) {
  const fixed = Math.abs(value).toFixed(2);
  if (value > 0) return `+${fixed}`;
  if (value < 0) return `-${fixed}`;
  return '0.00';
}

function buildPowerOptions(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    values.push(Number(value.toFixed(2)));
  }
  values.sort((a, b) => Math.abs(a) - Math.abs(b) || (a < 0 ? -1 : a > b ? 1 : 0));
  return values.map(formatPower);
}

function buildAxisOptions() {
  const all = Array.from({ length: 181 }, (_, index) => index);
  const common = all.filter((value) => value % 5 === 0);
  const rest = all.filter((value) => value % 5 !== 0);
  return [...common, ...rest].map(String);
}

function buildPdOptions() {
  const values: string[] = [];
  for (let value = 40; value <= 80; value += 0.5) {
    values.push(value.toFixed(1));
  }
  return values;
}

const VISION_ACUITY_OPTIONS = [
  '6/6',
  '6/9',
  '6/12',
  '6/18',
  '6/24',
  '6/36',
  '6/60',
  '6/5',
  '6/4',
  '6/3',
  '3/60',
  '2/60',
  '1/60',
  'CF',
  'HM',
  'PL',
  'NLP',
  '1.0',
  '0.8',
  '0.6',
  '0.5',
  '0.3',
  '0.1',
  'N6',
  'N8',
  'N10',
  'N12',
  'N18',
  'N24',
];

const OPTIONS: Record<PowerKind, string[]> = {
  sph: buildPowerOptions(-20, 20, 0.25),
  cyl: buildPowerOptions(-10, 10, 0.25),
  axis: buildAxisOptions(),
  add: buildPowerOptions(-4, 6, 0.25),
  prism: buildPowerOptions(-10, 10, 0.5),
  pd: buildPdOptions(),
  va: VISION_ACUITY_OPTIONS,
};

function filterPowerOptions(kind: PowerKind, query: string, options: string[]) {
  const q = query.trim().replace(/\s+/g, '');
  if (!q) return options;

  if (kind === 'va') return fuzzyRankSuggestions(q, options);

  if (kind === 'axis' || kind === 'pd') {
    const digits = q.replace(/[^\d.]/g, '');
    if (!digits) return options;
    return options
      .filter((option) => option.startsWith(digits))
      .sort((a, b) => Number(a) - Number(b));
  }

  const match = q.match(/^([+-])?(.*)$/);
  const sign = match?.[1] ?? '';
  const body = (match?.[2] ?? '').replace(/^\./, '0.');

  if (!body) {
    return options.filter((option) => !sign || option.startsWith(sign));
  }

  const bodyWithoutDot = body.endsWith('.') ? body.slice(0, -1) : body;
  return options.filter((option) => {
    if (sign && !option.startsWith(sign)) return false;
    const absolute = option.replace(/^[+-]/, '');
    return (
      absolute.startsWith(body) ||
      absolute.startsWith(bodyWithoutDot) ||
      option.startsWith(q)
    );
  });
}

interface PowerSelectProps {
  kind: PowerKind;
  value: string;
  onChange: (value: string) => void;
  onEdit?: () => void;
  className?: string;
  containerClassName?: string;
  dropdownClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  maxSuggestions?: number;
}

export default function PowerSelect({
  kind,
  value,
  onChange,
  onEdit,
  className = 'w-full rounded-md border border-th-border bg-th-elevated px-2 py-2 text-center text-sm font-medium text-th-text placeholder-th-secondary transition-all focus:border-th-accent focus:outline-none focus:ring-2 focus:ring-th-accent/20',
  containerClassName = '',
  dropdownClassName = '',
  placeholder = '-',
  ariaLabel,
  maxSuggestions = 120,
}: PowerSelectProps) {
  const options = OPTIONS[kind];
  const numeric = kind !== 'va';

  function handleChange(next: string) {
    onEdit?.();
    onChange(next);
  }

  return (
    <SmartSuggestInput
      value={value}
      onChange={handleChange}
      suggestions={options}
      filterOptions={(query, list) => filterPowerOptions(kind, query, list)}
      showOnEmpty
      maxSuggestions={maxSuggestions}
      inputMode={numeric ? 'decimal' : 'text'}
      placeholder={placeholder}
      aria-label={ariaLabel}
      spellCheck={false}
      className={className}
      containerClassName={containerClassName}
      dropdownClassName={dropdownClassName}
    />
  );
}
