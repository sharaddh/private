import { motion } from "framer-motion";
import { 
  Percent, CreditCard, Truck, MapPin, CalendarDays, 
  Banknote, Smartphone, CreditCard as CardIcon, Building2, Shield, CalendarClock
} from "lucide-react";

const PAYMENT_METHODS = [
  { value: "Cash", icon: Banknote },
  { value: "UPI", icon: Smartphone },
  { value: "Card", icon: CardIcon },
  { value: "Bank", icon: Building2 },
  { value: "Insurance", icon: Shield },
];

const DATE_SHORTCUTS = [
  { label: "Today", days: 0 },
  { label: "Tmrw", days: 1 },
  { label: "2 Days", days: 2 },
  { label: "3 Days", days: 3 },
  { label: "1 Week", days: 7 },
];

// Helper to get formatted YYYY-MM-DD date based on day offset
const getDateFromOffset = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
};

interface Props {
  discountType: "percent" | "amount";
  setDiscountType: (t: "percent" | "amount") => void;
  discountPercent: number;
  setDiscountPercent: (v: number) => void;
  discountAmount: number;
  setDiscountAmount: (v: number) => void;
  discountVal: number;
  totalAmount: number;
  advancePaid: number;
  setAdvancePaid: (v: number) => void;
  paymentMode: string;
  setPaymentMode: (v: string) => void;
  finalTotal: number;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
}

export default function PaymentPanel({
  discountType, setDiscountType, discountPercent, setDiscountPercent,
  discountAmount, setDiscountAmount, discountVal, totalAmount,
  advancePaid, setAdvancePaid, paymentMode, setPaymentMode, finalTotal,
  deliveryAddress, setDeliveryAddress, deliveryDate, setDeliveryDate,
}: Props) {
  
  const pendingBalance = Math.max(0, finalTotal - advancePaid);
  const isFullyPaid = advancePaid >= finalTotal;

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
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <Percent size={18} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Discount</h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Apply concession</p>
              </div>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-900/50 rounded-xl p-1 mb-4">
              <button
                onClick={() => setDiscountType("percent")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${discountType === "percent" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >Percentage (%)</button>
              <button
                onClick={() => setDiscountType("amount")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${discountType === "amount" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >Flat Amount (₹)</button>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">
                {discountType === "percent" ? "%" : "₹"}
              </span>
              <input 
                type="number"
                placeholder={discountType === "percent" ? "Enter %" : "Enter amount"}
                value={discountType === "percent" ? discountPercent || "" : discountAmount || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (discountType === "percent") setDiscountPercent(val);
                  else setDiscountAmount(val);
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          {/* Payment Panel */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <CreditCard size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Payment</h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Mode & advance collected</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const selected = paymentMode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMode(m.value)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-[10px] font-bold transition-all border ${
                      selected
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-400"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="truncate w-full text-center">{m.value}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
              <input 
                type="number" 
                placeholder="Advance Collected" 
                value={advancePaid || ""}
                onChange={(e) => setAdvancePaid(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" 
              />
              <button 
                onClick={() => setAdvancePaid(finalTotal)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Delivery Panel */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Truck size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Delivery Setup</h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Schedule when the order will be ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Delivery Date & Shortcuts */}
            <div className="space-y-3">
              <div className="relative">
                <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input 
                  type="date" 
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all cursor-pointer" 
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
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                        isActive
                          ? "bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-500/20 dark:border-primary-500/30 dark:text-primary-400 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50"
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
              <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <textarea 
                placeholder="Delivery / Shipping Address (Optional)" 
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-full min-h-[90px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Receipt Summary */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 shadow-xl sticky top-6 text-white border border-slate-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Banknote className="text-primary-400" />
            Summary
          </h3>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Subtotal</span>
              <span className="font-bold">₹{totalAmount.toLocaleString()}</span>
            </div>
            
            {discountVal > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-rose-400 font-medium">Discount</span>
                <span className="font-bold text-rose-400">-₹{discountVal.toLocaleString()}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-emerald-400 font-medium">Advance Paid ({paymentMode})</span>
              <span className="font-bold text-emerald-400">-₹{advancePaid.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-t border-slate-700/80 pt-5 mb-5 border-dashed">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-slate-400 mb-1">Final Total</span>
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

          <div className={`p-4 rounded-2xl flex items-center justify-between ${
            isFullyPaid ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-amber-500/20 border border-amber-500/30"
          }`}>
            <span className={`text-sm font-bold ${isFullyPaid ? "text-emerald-400" : "text-amber-400"}`}>
              {isFullyPaid ? "Fully Paid" : "Balance Due"}
            </span>
            <span className={`text-xl font-black tabular-nums tracking-tight ${isFullyPaid ? "text-emerald-400" : "text-amber-400"}`}>
              ₹{pendingBalance.toLocaleString()}
            </span>
          </div>

        </div>
      </div>
    </motion.div>
  );
}