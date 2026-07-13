import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, ScanLine, Search, Tag, Grid3X3, Eye,
  Barcode, Palette, Box, Maximize2, Sparkles, Building2, Layers
} from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface Frame { sku: string; brand: string; model: string; color: string; price: number }
interface Lens { sku: string; brand: string; features: string[]; index: string; price: number; coating: string }
interface Accessory { name: string; price: number }

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  onAdd: () => void;
  onScan?: () => void;
  children: React.ReactNode;
  emptyText: string;
}

function SectionCard({ icon, title, count, onAdd, onScan, children, emptyText }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{count} item{count !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onScan && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onScan}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ScanLine size={16} />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add
          </motion.button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {count === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[120px] border-2 border-dashed border-slate-100 dark:border-slate-700/50 rounded-xl">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">{children}</div>
        )}
      </div>
    </motion.div>
  );
}

interface OrderFramesProps {
  orderFrames: Frame[];
  updateFrame: (i: number, field: string, value: any) => void;
  removeFrame: (i: number) => void;
  onScan: () => void;
  searchInventory: (q: string, type: "frame", idx: number) => void;
  suggestions: any[];
  suggestionsFor: { type: "frame"; idx: number } | null;
  setSuggestions: (s: any[]) => void;
  setSuggestionsFor: (s: any) => void;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  setOrderFrames: (f: Frame[] | ((prev: Frame[]) => Frame[])) => void;
}

function OrderFrames({ orderFrames, updateFrame, removeFrame, onScan, searchInventory, suggestions, suggestionsFor, setSuggestions, setSuggestionsFor, isFocused, setIsFocused, setOrderFrames }: OrderFramesProps) {
  const { uiT } = useTranslate();

  return (
    <SectionCard
      icon={<Eye size={20} className="text-primary-600 dark:text-primary-400" />}
      title={uiT("Frames", "फ्रेम")}
      count={orderFrames.length}
      onAdd={() => setOrderFrames((prev) => [...prev, { sku: "", brand: "", model: "", color: "", price: 0 }])}
      onScan={onScan}
      emptyText={uiT("No frames added. Click Add or Scan.", "कोई फ्रेम नहीं जोड़ा गया। Add या Scan पर क्लिक करें।")}
    >
      <AnimatePresence>
        {orderFrames.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 relative group"
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative col-span-1 sm:col-span-2">
                <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  placeholder="SKU / Barcode"
                  value={f.sku}
                  onChange={(e) => { updateFrame(i, "sku", e.target.value); searchInventory(e.target.value, "frame", i); }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                />

                {suggestionsFor?.type === "frame" && suggestionsFor.idx === i && isFocused && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30">
                    {suggestions.map((s: any, si: number) => (
                      <button key={si} type="button"
                        onMouseDown={() => {
                          updateFrame(i, "sku", s.sku || ""); updateFrame(i, "brand", s.brand || "");
                          updateFrame(i, "model", s.model || ""); updateFrame(i, "color", s.color || "");
                          updateFrame(i, "price", s.sellingPrice || 0); setSuggestions([]); setSuggestionsFor(null);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/30 last:border-0 transition-colors"
                      >
                        <Search size={14} className="text-primary-500" />
                        <span className="font-bold text-slate-900 dark:text-white">{s.sku}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{s.brand} {s.model}</span>
                        <span className="text-slate-900 dark:text-white font-semibold ml-auto">₹{s.sellingPrice || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input placeholder={uiT("Brand", "ब्रांड")} value={f.brand} onChange={(e) => updateFrame(i, "brand", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>
              <div className="relative">
                <Box size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input placeholder={uiT("Model", "मॉडल")} value={f.model} onChange={(e) => updateFrame(i, "model", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>
              <div className="relative">
                <Palette size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input placeholder={uiT("Color", "रंग")} value={f.color} onChange={(e) => updateFrame(i, "color", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                <input type="number" placeholder={uiT("Price", "मूल्य")} value={f.price || ""} onChange={(e) => updateFrame(i, "price", Number(e.target.value))} onWheel={(e) => (e.target as HTMLElement).blur()} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => removeFrame(i)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex-shrink-0 mt-1"
            >
              <X size={15} strokeWidth={2.5} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </SectionCard>
  );
}

interface OrderLensesProps {
  orderLenses: Lens[];
  updateLens: (i: number, field: string, value: any) => void;
  removeLens: (i: number) => void;
  setOrderLenses: (l: Lens[] | ((prev: Lens[]) => Lens[])) => void;
}

function OrderLenses({ orderLenses, updateLens, removeLens, setOrderLenses }: OrderLensesProps) {
  const { uiT } = useTranslate();

  const LENS_FEATURES = [
    uiT("Single Vision", "सिंगल विज़न"),
    uiT("Bifocal", "बाइफोकल"),
    uiT("Progressive", "प्रोग्रेसिव"),
    uiT("Bluecut", "ब्लूकट"),
    uiT("Photochromic", "फोटोक्रोमिक"),
    uiT("Anti-Glare", "एंटी-ग्लेयर"),
  ];

  return (
    <SectionCard
      icon={<Layers size={20} className="text-primary-600 dark:text-primary-400" />}
      title={uiT("Lenses", "लेंस")}
      count={orderLenses.length}
      onAdd={() => setOrderLenses((prev) => [...prev, { sku: "", brand: "", features: [], index: "", price: 0, coating: "" }])}
      emptyText={uiT("No lenses added. Click Add.", "कोई लेंस नहीं जोड़ा गया। Add पर क्लिक करें।")}
    >
      <AnimatePresence>
        {orderLenses.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3"
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">

              <div className="relative col-span-1 sm:col-span-2">
                <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input placeholder="SKU" value={l.sku} onChange={(e) => updateLens(i, "sku", e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>

              {/* Multi-Select Chips for Features */}
              <div className="col-span-1 sm:col-span-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Layers size={12} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{uiT("Lens Types & Features", "लेंस प्रकार और विशेषताएँ")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LENS_FEATURES.map((feature) => {
                    const isSelected = l.features.includes(feature);
                    return (
                      <button
                        key={feature}
                        type="button"
                        onClick={() => {
                          const newFeatures = isSelected
                            ? l.features.filter((f) => f !== feature)
                            : [...l.features, feature];
                          updateLens(i, "features", newFeatures);
                        }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-primary-500 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        {feature}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input placeholder={uiT("Brand", "ब्रांड")} value={l.brand} onChange={(e) => updateLens(i, "brand", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>

              <div className="relative">
                <Maximize2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input placeholder={uiT("Index (e.g. 1.61)", "इंडेक्स (जैसे 1.61)")} value={l.index} onChange={(e) => updateLens(i, "index", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>

              <div className="relative">
                <Sparkles size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input placeholder={uiT("Coating", "कोटिंग")} value={l.coating} onChange={(e) => updateLens(i, "coating", e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>

              <div className="relative col-span-1 sm:col-span-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                <input type="number" placeholder={uiT("Price", "मूल्य")} value={l.price || ""} onChange={(e) => updateLens(i, "price", Number(e.target.value))} onWheel={(e) => (e.target as HTMLElement).blur()} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => removeLens(i)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex-shrink-0 mt-1"
            >
              <X size={15} strokeWidth={2.5} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </SectionCard>
  );
}

interface OrderAccessoriesProps {
  orderAccessories: Accessory[];
  updateAccessory: (i: number, field: string, value: any) => void;
  removeAccessory: (i: number) => void;
  setOrderAccessories: (a: Accessory[] | ((prev: Accessory[]) => Accessory[])) => void;
}

function OrderAccessories({ orderAccessories, updateAccessory, removeAccessory, setOrderAccessories }: OrderAccessoriesProps) {
  const { uiT } = useTranslate();

  return (
    <div className="w-full">
      <SectionCard
        icon={<Grid3X3 size={20} className="text-primary-600 dark:text-primary-400" />}
        title={uiT("Accessories", "एक्सेसरीज़")}
        count={orderAccessories.length}
        onAdd={() => setOrderAccessories((prev) => [...prev, { name: "", price: 0 }])}
        emptyText={uiT("No accessories added yet.", "अभी तक कोई एक्सेसरी नहीं जोड़ी गई।")}
      >
        <AnimatePresence>
          {orderAccessories.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Box size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input placeholder={uiT("Accessory Name", "एक्सेसरी का नाम")} value={a.name} onChange={(e) => updateAccessory(i, "name", e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input type="number" placeholder={uiT("Price", "मूल्य")} value={a.price || ""} onChange={(e) => updateAccessory(i, "price", Number(e.target.value))} onWheel={(e) => (e.target as HTMLElement).blur()} className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => removeAccessory(i)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex-shrink-0"
              >
                <X size={16} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </SectionCard>
    </div>
  );
}

interface Props {
  orderFrames: Frame[]; setOrderFrames: (f: Frame[] | ((prev: Frame[]) => Frame[])) => void;
  updateFrame: (i: number, field: string, value: any) => void; removeFrame: (i: number) => void;
  orderLenses: Lens[]; setOrderLenses: (l: Lens[] | ((prev: Lens[]) => Lens[])) => void;
  updateLens: (i: number, field: string, value: any) => void; removeLens: (i: number) => void;
  orderAccessories: Accessory[]; setOrderAccessories: (a: Accessory[] | ((prev: Accessory[]) => Accessory[])) => void;
  updateAccessory: (i: number, field: string, value: any) => void; removeAccessory: (i: number) => void;
  setStep: (s: string) => void;
  onScan: () => void; searchInventory: (q: string, type: "frame", idx: number) => void;
  suggestions: any[]; suggestionsFor: { type: "frame"; idx: number } | null;
  setSuggestions: (s: any[]) => void; setSuggestionsFor: (s: any) => void;
  isFocused: boolean; setIsFocused: (v: boolean) => void;
}

export default function OrderItems(props: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <OrderFrames {...props} />
        <OrderLenses {...props} />
      </div>

      <OrderAccessories {...props} />
    </motion.div>
  );
}
