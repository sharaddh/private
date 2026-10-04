import { motion } from 'framer-motion';
import {
  Percent,
  CreditCard,
  Truck,
  MapPin,
  CalendarDays,
  Banknote,
  CalendarClock,
} from 'lucide-react';
import { useTranslate } from '../../context/TranslateContext';
import { toDateKey } from '../../utils/date';
import SplitPaymentInput from '../SplitPaymentInput';
import { CANONICAL_PAYMENT_MODES } from '../../constants/paymentModes';
import {
  isSplitActive,
  nonZeroRows,
  primaryRow,
  splitTotal,
  type SplitRow,
} from '../../utils/splitAllocation';

/** Hindi display labels, kept beside the modes so the tiles read as before. */
const MODE_LABELS: Record<string, string> = {
  Cash: 'नकद',
  Card: 'कार्ड',
  'Bank Transfer': 'बैंक',
  Insurance: 'बीमा',
};

const getDateFromOffset = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return toDateKey(date);
};

interface Props {
  discountType: 'percent' | 'amount';
  setDiscountType: (t: 'percent' | 'amount') => void;
  discountPercent: number;
  setDiscountPercent: (v: number) => void;
  discountAmount: number;
  setDiscountAmount: (v: number) => void;
  discountVal: number;
  totalAmount: number;
  /**
   * The tender rows, 1 or 2. Row 1 is the legacy `amount`/`mode` pair and a
   * second non-zero row makes it a split. Controlled — the panel holds no
   * payment state of its own.
   *
   * Optional so the panel stays source-compatible with the unfired duplicate
   * screen under `pages/CustomerNewVisit/`, which still passes only the legacy
   * single-mode props. That copy is dead (never bundled) and is deliberately not
   * being kept in sync, so the shared component has to keep answering to both.
   */
  splits?: SplitRow[];
  setSplits?: (rows: SplitRow[]) => void;
  /** Legacy single-mode amount. Used only when `splits` is not supplied. */
  advancePaid?: number;
  setAdvancePaid?: (v: number) => void;
  /** Legacy single-mode mode. Used only when `splits` is not supplied. */
  paymentMode?: string;
  setPaymentMode?: (v: string) => void;
  finalTotal: number;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  hideDelivery?: boolean;
}

export default function PaymentPanel({
  discountType,
  setDiscountType,
  discountPercent,
  setDiscountPercent,
  discountAmount,
  setDiscountAmount,
  discountVal,
  totalAmount,
  splits,
  setSplits,
  advancePaid: legacyAdvancePaid,
  setAdvancePaid,
  paymentMode: legacyPaymentMode,
  setPaymentMode,
  finalTotal,
  deliveryAddress,
  setDeliveryAddress,
  deliveryDate,
  setDeliveryDate,
  hideDelivery = false,
}: Props) {
  const { uiT } = useTranslate();

  const rows: SplitRow[] = splits ?? [
    { mode: legacyPaymentMode ?? 'Cash', amount: legacyAdvancePaid ?? 0 },
  ];

  const advancePaid = splitTotal(rows);
  const paymentMode = primaryRow(rows).mode;
  const pendingBalance = Math.max(0, finalTotal - advancePaid);
  const isFullyPaid = advancePaid >= finalTotal;
  const splitActive = isSplitActive(rows);

  /**
   * Route an edit back to whichever shape the caller supplied. A caller that
   * passed both gets both kept in step, so a half-migrated screen cannot drift.
   */
  function updateRows(next: SplitRow[]) {
    if (setSplits) setSplits(next);
    setAdvancePaid?.(splitTotal(next));
    setPaymentMode?.(primaryRow(next).mode);
  }

  const PAYMENT_METHODS = CANONICAL_PAYMENT_MODES;

  const DATE_SHORTCUTS = [
    { label: uiT('Today', 'आज'), days: 0 },
    { label: uiT('Tmrw', 'कल'), days: 1 },
    { label: uiT('2 Days', '2 दिन'), days: 2 },
    { label: uiT('3 Days', '3 दिन'), days: 3 },
    { label: uiT('1 Week', '1 सप्ताह'), days: 7 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
    >
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        {/* Discount & Payment Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discount Panel */}
          <div className="bg-th-surface rounded-lg shadow-lg p-5 h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-sm bg-[#e53935]/10 flex items-center justify-center">
                <Percent size={18} className="text-[#e53935]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-th-text">{uiT('Discount', 'छूट')}</h2>
                <p className="text-[15px] font-medium text-th-secondary">
                  {uiT('Apply concession', 'छूट लागू करें')}
                </p>
              </div>
            </div>

            <div className="flex bg-th-elevated rounded-md p-1 mb-4">
              <button
                onClick={() => setDiscountType('percent')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${discountType === 'percent' ? 'bg-[#1ed760] text-black' : 'text-th-secondary hover:text-th-text'}`}
              >
                {uiT('Percentage (%)', 'प्रतिशत (%)')}
              </button>
              <button
                onClick={() => setDiscountType('amount')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${discountType === 'amount' ? 'bg-[#1ed760] text-black' : 'text-th-secondary hover:text-th-text'}`}
              >
                {uiT('Flat Amount (₹)', 'निश्चित राशि (₹)')}
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-th-secondary font-bold">
                {discountType === 'percent' ? '%' : '₹'}
              </span>
              <input
                type="number"
                placeholder={
                  discountType === 'percent'
                    ? uiT('Enter %', '% दर्ज करें')
                    : uiT('Enter amount', 'राशि दर्ज करें')
                }
                value={discountType === 'percent' ? discountPercent || '' : discountAmount || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (discountType === 'percent') setDiscountPercent(val);
                  else setDiscountAmount(val);
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                className="w-full pl-9 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </div>

          {/* Payment Panel */}
          <div className="bg-th-surface rounded-lg shadow-lg p-5 h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
                <CreditCard size={18} className="text-[#1ed760]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-th-text">{uiT('Payment', 'भुगतान')}</h2>
                <p className="text-[15px] font-medium text-th-secondary">
                  {uiT('Mode & advance collected', 'मोड और अग्रिम एकत्र')}
                </p>
              </div>
            </div>

            <SplitPaymentInput
              rows={rows}
              onChange={updateRows}
              collectable={finalTotal}
              modes={PAYMENT_METHODS}
              modeLabels={MODE_LABELS}
              variant="tiles"
              showMaxButton
              amountPlaceholder={uiT('Advance Collected', 'अग्रिम एकत्र')}
            />
          </div>
        </div>

        {/* Delivery Panel */}
        {!hideDelivery && (
          <div className="bg-th-surface rounded-lg shadow-lg p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
              <Truck size={18} className="text-[#1ed760]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-th-text">
                {uiT('Delivery Setup', 'डिलीवरी सेटअप')}
              </h2>
              <p className="text-[15px] font-medium text-th-secondary">
                {uiT(
                  'Schedule when the order will be ready',
                  'शेड्यूल करें कि ऑर्डर कब तैयार होगा'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Delivery Date & Shortcuts */}
            <div className="space-y-3">
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none"
                />
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {DATE_SHORTCUTS.map((shortcut) => {
                  const targetDate = getDateFromOffset(shortcut.days);
                  const isActive = deliveryDate === targetDate;
                  return (
                    <button
                      key={shortcut.label}
                      onClick={() => setDeliveryDate(targetDate)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[15px] font-bold transition-all ${
                        isActive
                          ? 'bg-[#1ed760] text-black'
                          : 'bg-th-elevated text-th-secondary hover:bg-th-card'
                      }`}
                    >
                      <CalendarClock size={12} />
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3.5 top-3.5 text-th-secondary pointer-events-none"
              />
              <textarea
                placeholder={uiT(
                  'Delivery / Shipping Address (Optional)',
                  'डिलीवरी / शिपिंग पता (वैकल्पिक)'
                )}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-full min-h-[90px] pl-10 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Right Column: Receipt Summary */}
      <div className="lg:col-span-1">
        <div className="bg-th-surface rounded-lg p-6 sticky top-6 text-th-text shadow-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Banknote className="text-[#1ed760]" />
            {uiT('Summary', 'सारांश')}
          </h3>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-th-secondary font-medium">{uiT('Subtotal', 'उप-योग')}</span>
              <span className="font-bold">₹{totalAmount.toLocaleString()}</span>
            </div>

            {discountVal > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#e53935] font-medium">{uiT('Discount', 'छूट')}</span>
                <span className="font-bold text-[#e53935]">-₹{discountVal.toLocaleString()}</span>
              </div>
            )}

            {splitActive ? (
              nonZeroRows(rows).map((row, i) => (
                <div key={`${row.mode}-${i}`} className="flex justify-between items-center text-sm">
                  <span className="text-[#1ed760] font-medium">
                    {uiT('Advance Paid', 'अग्रिम भुगतान')} ({row.mode})
                  </span>
                  <span className="font-bold text-[#1ed760] tabular-nums">
                    -₹{row.amount.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#1ed760] font-medium">
                  {uiT('Advance Paid', 'अग्रिम भुगतान')} ({paymentMode})
                </span>
                <span className="font-bold text-[#1ed760]">-₹{advancePaid.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="border-t border-th-elevated pt-5 mb-5 border-dashed">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-th-secondary mb-1">
                {uiT('Final Total', 'अंतिम कुल')}
              </span>
              <motion.span
                key={finalTotal}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="text-3xl font-black tabular-nums tracking-tight"
              >
                ₹{finalTotal.toLocaleString()}
              </motion.span>
            </div>
          </div>

          <div
            className={`p-4 rounded-md flex items-center justify-between ${
              isFullyPaid
                ? 'bg-[#1ed760]/10 shadow-[0_0_0_1px_#1ed760]'
                : 'bg-[#ff9500]/10 shadow-[0_0_0_1px_#ff9500]'
            }`}
          >
            <span
              className={`text-sm font-bold ${isFullyPaid ? 'text-[#1ed760]' : 'text-[#ff9500]'}`}
            >
              {isFullyPaid ? uiT('Fully Paid', 'पूर्ण भुगतान') : uiT('Balance Due', 'शेष देय')}
            </span>
            <span
              className={`text-xl font-black tabular-nums tracking-tight ${isFullyPaid ? 'text-[#1ed760]' : 'text-[#ff9500]'}`}
            >
              ₹{pendingBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
