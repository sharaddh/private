import { Banknote, Building2, CreditCard, Plus, Shield, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useTranslate } from '../context/TranslateContext';
import {
  allocation,
  isOverAllocated,
  isSplitActive,
  MAX_SPLIT_ROWS,
  primaryRow,
  type SplitRow,
} from '../utils/splitAllocation';

interface Props {
  /** Always 1 or 2 rows. Controlled — this component holds no payment state. */
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  /** The most that can be collected here. Drives the readout and the guard. */
  collectable: number;
  /** Modes this payment point offers. Pickup deliberately offers only 3. */
  modes: readonly string[];
  /** Hindi display labels, keyed by the same strings as `modes`. */
  modeLabels?: Record<string, string>;
  /** Matches each host screen's existing mode control so the UI does not shift. */
  variant?: 'tiles' | 'buttons' | 'select';
  disabled?: boolean;
  amountLabel?: string;
  amountPlaceholder?: string;
  /** Show the "Max" shortcut that fills the remaining collectable amount. */
  showMaxButton?: boolean;
}

const MODE_ICONS: Record<string, typeof Banknote> = {
  Cash: Banknote,
  UPI: Smartphone,
  Card: CreditCard,
  'Bank Transfer': Building2,
  Insurance: Shield,
};

/**
 * Written as literals, not interpolated. Tailwind purges class names it cannot
 * see in the source, so `grid-cols-${n}` would compile to nothing.
 */
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function SplitPaymentInput({
  rows,
  onChange,
  collectable,
  modes,
  modeLabels,
  variant = 'buttons',
  disabled = false,
  amountLabel,
  amountPlaceholder,
  showMaxButton = false,
}: Props) {
  const { uiT } = useTranslate();

  const primary = primaryRow(rows);
  const second = rows[1];
  const splitOn = isSplitActive(rows) || !!second;
  const state = allocation(rows, collectable);
  const over = isOverAllocated(rows, collectable);

  const labelFor = (mode: string) => (modeLabels?.[mode] ? uiT(mode, modeLabels[mode]) : mode);
  const gridCols = GRID_COLS[modes.length] ?? 'grid-cols-3';

  function setRow(index: number, patch: Partial<SplitRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addSecondRow() {
    if (second || rows.length >= MAX_SPLIT_ROWS) return;
    // Prefer a mode the first row is not already using, so the split reads as a
    // genuine two-mode tender without the user having to change anything.
    const nextMode = modes.find((m) => m !== primary.mode) ?? modes[0] ?? 'Cash';
    // Seed row 2 with whatever is still unallocated, so the common case
    // ("half cash, half card") is one tap rather than two fields of typing.
    const remainder = Math.max(0, collectable - primary.amount);
    onChange([primary, { mode: nextMode, amount: remainder }]);
  }

  function removeSecondRow() {
    onChange([primary]);
  }

  const modeControl = (index: number, current: string, ariaSuffix: string) => {
    if (variant === 'select') {
      return (
        <select
          className="input-field"
          value={current}
          disabled={disabled}
          aria-label={`${uiT('Payment mode', 'भुगतान मोड')} ${ariaSuffix}`}
          onChange={(e) => setRow(index, { mode: e.target.value })}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {labelFor(m)}
            </option>
          ))}
        </select>
      );
    }

    if (variant === 'tiles') {
      return (
        <div className={`grid ${gridCols} gap-2`}>
          {modes.map((m) => {
            const Icon = MODE_ICONS[m] ?? Wallet;
            const selected = current === m;
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`${uiT('Payment mode', 'भुगतान मोड')} ${ariaSuffix}: ${m}`}
                onClick={() => setRow(index, { mode: m })}
                className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-md text-[14px] font-bold transition-all ${
                  selected
                    ? 'bg-[#1ed760]/10 text-[#1ed760] shadow-[0_0_0_1px_#1ed760]'
                    : 'bg-th-elevated text-th-secondary hover:bg-th-card'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="truncate w-full text-center">{labelFor(m)}</span>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`grid ${gridCols} gap-1.5`}>
        {modes.map((m) => {
          const selected = current === m;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${uiT('Payment mode', 'भुगतान मोड')} ${ariaSuffix}: ${m}`}
              onClick={() => setRow(index, { mode: m })}
              className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                selected
                  ? 'bg-[#1ed760] text-black border-[#1ed760]'
                  : 'bg-th-elevated text-th-secondary border-th-border'
              }`}
            >
              {labelFor(m)}
            </button>
          );
        })}
      </div>
    );
  };

  const amountField = (index: number, row: SplitRow) => (
    <div>
      {amountLabel && (
        <label className="block text-xs font-medium text-th-secondary mb-1">{amountLabel}</label>
      )}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-th-secondary font-bold">
          ₹
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          disabled={disabled}
          placeholder={amountPlaceholder}
          aria-label={`${uiT('Amount', 'राशि')} ${index === 0 ? uiT('row 1', 'पंक्ति 1') : uiT('row 2', 'पंक्ति 2')}`}
          value={row.amount || ''}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          onChange={(e) => setRow(index, { amount: Number(e.target.value) })}
          className="w-full pl-9 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all disabled:opacity-50"
        />
        {showMaxButton && index === 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRow(0, { amount: collectable })}
            aria-label={uiT('Collect full amount', 'पूरी राशि')}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-th-card text-[14px] font-bold rounded-md text-th-text hover:bg-[#1ed760] hover:text-black transition-colors"
          >
            Max
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Row 1 */}
      <div className="space-y-2">
        {modeControl(0, primary.mode, uiT('row 1', 'पंक्ति 1'))}
        {amountField(0, primary)}
      </div>

      {/* Split toggle */}
      {!second ? (
        <button
          type="button"
          disabled={disabled}
          onClick={addSecondRow}
          aria-label={uiT('Split across a second payment mode', 'दूसरे मोड में विभाजित करें')}
          className="w-full py-2 rounded-lg border border-dashed border-th-border text-xs font-bold text-th-secondary hover:border-[#1ed760] hover:text-[#1ed760] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Plus size={14} aria-hidden="true" />
          {uiT('+ Split', '+ विभाजित करें')}
        </button>
      ) : (
        <div className="space-y-2 pt-1 border-t border-dashed border-th-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-th-secondary">
              {uiT('Second mode', 'दूसरा मोड')}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={removeSecondRow}
              aria-label={uiT('Remove second payment mode', 'दूसरा मोड हटाएं')}
              className="inline-flex items-center gap-1 text-xs font-bold text-th-secondary hover:text-[#e53935] transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} aria-hidden="true" />
              {uiT('Remove', 'हटाएं')}
            </button>
          </div>
          {modeControl(1, second.mode, uiT('row 2', 'पंक्ति 2'))}
          {amountField(1, second)}
        </div>
      )}

      {/* Live allocation readout */}
      {state.total > 0 && (
        <div
          className={`rounded-md px-3 py-2 text-xs font-bold flex items-center justify-between ${
            over ? 'bg-[#e53935]/10 text-[#e53935]' : 'bg-th-elevated text-th-secondary'
          }`}
          role="status"
        >
          <span className="tabular-nums">
            {uiT('Allocated', 'आवंटित')} {money(state.total)} {uiT('of', 'में से')}{' '}
            {money(collectable)}
          </span>
          {!over && state.remaining > 0 && (
            <span className="tabular-nums">
              {money(state.remaining)} {uiT('still due', 'बाकी है')}
            </span>
          )}
        </div>
      )}

      {over && (
        <p className="text-xs font-bold text-[#e53935]" role="alert">
          {uiT(
            `Split exceeds the collectable ${money(collectable)} by ${money(state.total - collectable)}.`,
            `विभाजित राशि एकत्र करने योग्य ${money(collectable)} से ${money(state.total - collectable)} अधिक है।`
          )}
        </p>
      )}

      {splitOn && !state.split && state.total === 0 && (
        <p className="text-xs text-th-secondary">
          {uiT(
            'Set an amount on at least one row to record a payment.',
            'भुगतान दर्ज करने के लिए कम से कम एक पंक्ति में राशि दर्ज करें।'
          )}
        </p>
      )}
    </div>
  );
}
