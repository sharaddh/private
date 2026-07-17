import { motion } from "framer-motion";
import { Plus, X, FileText } from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface BillItem {
  _id?: string;
  description: string;
  price: number;
  qty: number;
}

interface Props {
  billItems: BillItem[];
  setBillItems: (items: BillItem[] | ((prev: BillItem[]) => BillItem[])) => void;
  updateBillItem: (i: number, field: string, value: any) => void;
  removeBillItem: (i: number) => void;
  totalAmount: number;
}

export default function BillingPanel({ billItems, setBillItems, updateBillItem, removeBillItem, totalAmount }: Props) {
  const { uiT } = useTranslate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-5"
    >
      <div className="bg-th-surface rounded-lg shadow-lg p-5">

        {/* Header Section */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
              <FileText size={20} className="text-[#1ed760]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-th-text">{uiT("Bill Items", "बिल आइटम")}</h2>
              <span className="text-[11px] font-medium text-th-secondary">
                {billItems.length} {uiT("item(s)", "आइटम")}
              </span>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setBillItems((prev) => [...prev, { description: "", price: 0, qty: 1 }])}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1ed760] text-black text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            {uiT("Add Item", "आइटम जोड़ें")}
          </motion.button>
        </div>

        {/* List Section */}
        {billItems.length === 0 ? (
          <div className="flex items-center justify-center min-h-[120px] rounded-md bg-th-elevated">
            <p className="text-xs font-medium text-th-secondary">{uiT("No bill items. Add items manually or sync from the order.", "कोई बिल आइटम नहीं। मैन्युअल रूप से आइटम जोड़ें या ऑर्डर से सिंक करें।")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {billItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 bg-th-elevated rounded-md p-3"
              >
                {/* Description Input */}
                <input
                  placeholder={uiT("Description", "विवरण")}
                  value={item.description}
                  onChange={(e) => updateBillItem(i, "description", e.target.value)}
                  className="flex-1 px-3 py-2 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-muted border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />

                {/* Price Input */}
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-th-secondary">₹</span>
                  <input
                    type="number"
                    placeholder={uiT("Price", "मूल्य")}
                    value={item.price || ""}
                    onChange={(e) => updateBillItem(i, "price", Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-full pl-7 pr-3 py-2 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-muted border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>

                {/* Qty Input */}
                <div className="relative w-16">
                  <input
                    type="number"
                    placeholder={uiT("Qty", "मात्रा")}
                    value={item.qty || 1}
                    min="1"
                    onChange={(e) => updateBillItem(i, "qty", Math.max(1, Number(e.target.value)))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-full px-2 py-2 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-muted text-center border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>

                {/* Line Total */}
                <span className="text-sm font-bold text-th-text w-20 text-right tabular-nums">
                  ₹{(item.price * item.qty).toFixed(0)}
                </span>

                {/* Delete Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => removeBillItem(i)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-[#e53935]/10 text-[#e53935] transition-colors flex-shrink-0"
                >
                  <X size={15} strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer / Total Section */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#1f1f1f]">
          <span className="text-sm font-bold text-th-secondary uppercase tracking-wider">{uiT("Total Amount", "कुल राशि")}</span>
          <motion.span
            key={totalAmount}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold text-[#1ed760] tabular-nums"
          >
            ₹{totalAmount.toLocaleString()}
          </motion.span>
        </div>

      </div>
    </motion.div>
  );
}
