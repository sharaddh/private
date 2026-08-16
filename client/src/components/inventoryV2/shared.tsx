import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { MovementType } from '../../types/inventoryV2';

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockBadgeClass(qty: number, threshold = 5): string {
  if (qty <= 0) return 'badge badge-red';
  if (qty <= threshold) return 'badge badge-yellow';
  return 'badge badge-green';
}

export function stockTextClass(qty: number, threshold = 5): string {
  if (qty <= 0) return 'text-[#e74c3c]';
  if (qty <= threshold) return 'text-amber-400';
  return 'text-[#1ed760]';
}

export function stockLevel(qty: number, threshold = 5): 'out' | 'low' | 'ok' {
  if (qty <= 0) return 'out';
  if (qty <= threshold) return 'low';
  return 'ok';
}

const STOCK_LEVEL_LABEL: Record<'out' | 'low' | 'ok', string> = {
  out: 'Out of stock',
  low: 'Low stock',
  ok: 'In stock',
};

export function StockStatusBadge({ qty, threshold = 5 }: { qty: number; threshold?: number }) {
  const level = stockLevel(qty, threshold);
  return (
    <span className={`badge ${stockBadgeClass(qty, threshold)}`} title={STOCK_LEVEL_LABEL[level]}>
      {level === 'ok' ? 'In stock' : level === 'low' ? 'Low' : 'Out'}
    </span>
  );
}

export function itemLabel(
  v?: { brandName?: string; model?: string; color?: string; size?: string } | null
): string {
  if (!v) return '—';
  return (
    [v.brandName, v.model, v.color, v.size ? `/${v.size}` : ''].filter(Boolean).join(' ').trim() ||
    '—'
  );
}

export const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_BALANCE: 'Opening balance',
  PURCHASE: 'Purchase',
  ORDER: 'Sold on order',
  WITHDRAWAL: 'Withdrawal',
  RETURN: 'Return',
  DAMAGE: 'Damage',
  ADJUSTMENT: 'Manual adjustment',
  COUNT_CORRECTION: 'Stock count correction',
  TRANSFER_IN: 'Transferred in',
  TRANSFER_OUT: 'Transferred out',
  LOCATION_CHANGE: 'Moved to another rack',
  STOCK_IN: 'Stock added',
  STOCK_OUT: 'Stock removed',
  CREATED: 'Item created',
  WITHDRAWAL_REVERSED: 'Withdrawal reversed',
  DAMAGED: 'Marked damaged',
};

export function movementLabel(type: string): string {
  return MOVEMENT_LABELS[type] ?? (type || 'Activity');
}

export function movementTone(type: string): string {
  switch (type) {
    case 'OPENING_BALANCE':
    case 'PURCHASE':
    case 'RETURN':
    case 'TRANSFER_IN':
    case 'STOCK_IN':
    case 'CREATED':
    case 'WITHDRAWAL_REVERSED':
      return 'bg-[#1ed760]/10 text-[#1ed760]';
    case 'WITHDRAWAL':
    case 'ORDER':
    case 'TRANSFER_OUT':
    case 'STOCK_OUT':
    case 'DAMAGE':
    case 'DAMAGED':
      return 'bg-[#e74c3c]/10 text-[#e74c3c]';
    case 'COUNT_CORRECTION':
    case 'ADJUSTMENT':
    case 'LOCATION_CHANGE':
      return 'bg-amber-500/10 text-amber-400';
    default:
      return 'bg-th-hover text-th-secondary';
  }
}

export function MovementTypeBadge({ type }: { type: MovementType | string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${movementTone(type)}`}
    >
      {movementLabel(type)}
    </span>
  );
}

export function PageSection({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-th-surface rounded-[8px] shadow-sm border border-th-border ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className="text-[#1ed760]" />
          <div>
            <h3 className="text-base font-semibold text-th-text leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-th-secondary mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

export function QuickActionButton({
  icon: Icon,
  label,
  hint,
  tone = 'green',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tone?: 'green' | 'neutral' | 'red' | 'amber';
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    green: 'hover:bg-[#1ed760]/10 hover:border-[#1ed760]/30 text-[#1ed760]',
    neutral: 'hover:bg-th-hover text-th-text',
    red: 'hover:bg-[#e74c3c]/10 hover:border-[#e74c3c]/30 text-[#e74c3c]',
    amber: 'hover:bg-amber-500/10 hover:border-amber-500/30 text-amber-400',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[8px] border border-th-border bg-th-surface px-4 py-3 text-left transition-all active:scale-[0.98] ${tones[tone]}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-th-elevated flex-shrink-0">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-th-text">{label}</span>
        {hint && <span className="block text-xs text-th-secondary truncate">{hint}</span>}
      </span>
    </button>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-th-secondary mb-1.5">
        {label} {required && <span className="text-[#e74c3c]">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover';
export const inputStyle = { border: '1px solid rgb(124,124,124)' } as const;

export function AdvancedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-[8px] border border-th-border bg-th-base/60">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-th-secondary hover:text-th-text select-none">
        {title}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pages, total, pageSize = 20, onPage }: PaginationProps) {
  if (pages <= 1) return null;
  const start = Math.max(0, Math.min(page - 1 - 2, pages - 5));
  const pgs = Array.from({ length: Math.min(pages, 5) }, (_, i) => start + i + 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-sm text-th-secondary">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pgs.map((pg) => (
          <button
            type="button"
            key={pg}
            onClick={() => onPage(pg)}
            className={`w-8 h-8 rounded-[9999px] text-sm font-medium transition-colors ${
              pg === page ? 'bg-[#1ed760] text-black' : 'hover:bg-th-elevated text-th-secondary'
            }`}
          >
            {pg}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-th-muted">
      <Icon size={44} className="mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
