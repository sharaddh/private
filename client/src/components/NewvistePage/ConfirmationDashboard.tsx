import { motion } from "framer-motion";
import {
  CheckCircle, Eye, Tag, Grid3X3, FileText, CreditCard,
  Truck, Activity, MapPin, CalendarDays, User, HeartPulse, Sparkles
} from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";
import { hasEyeData } from "../../utils/rx";

// Safe color mapping to prevent Tailwind purging dynamically created class names
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-[#1ed760]/10", text: "text-[#1ed760]" },
  blue: { bg: "bg-[#1ed760]/10", text: "text-[#1ed760]" },
  emerald: { bg: "bg-[#1ed760]/10", text: "text-[#1ed760]" },
  violet: { bg: "bg-[#1ed760]/10", text: "text-[#1ed760]" },
  amber: { bg: "bg-[#1ed760]/10", text: "text-[#1ed760]" },
  rose: { bg: "bg-[#e53935]/10", text: "text-[#e53935]" },
  slate: { bg: "bg-th-elevated", text: "text-th-secondary" },
};

function SummaryCard({ icon, title, children, color = "primary" }: { icon: React.ReactNode; title: string; children: React.ReactNode; color?: string }) {
  const theme = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-th-surface rounded-lg shadow-lg p-5 flex flex-col h-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${theme.bg} ${theme.text}`}>
          {icon}
        </div>
        <h4 className="text-sm font-bold text-th-text tracking-wide">{title}</h4>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </motion.div>
  );
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

interface Props {
  visitType: string; visitDate: string; visitDoctor: string; visitRemarks: string;
  usePrescription: boolean; prescription: { pd: string; problems: string; notes: string; rightEye: Record<string, any>; leftEye: Record<string, any> };
  orderFrames: Array<{ brand: string; model: string; color: string; price: number }>;
  orderLenses: Array<{ brand: string; features: string[]; coating: string; price: number }>;
  orderAccessories: Array<{ name: string; price: number }>;
  billItems: Array<{ description: string; price: number; qty: number }>;
  totalAmount: number; discountVal: number; finalTotal: number; advancePaid: number;
  deliveryAddress: string; deliveryDate: string;
}

export default function ConfirmationDashboard({
  visitType, visitDate, visitDoctor, visitRemarks, usePrescription, prescription,
  orderFrames, orderLenses, orderAccessories, billItems, totalAmount, discountVal,
  finalTotal, advancePaid, deliveryAddress, deliveryDate,
}: Props) {
  const { uiT } = useTranslate();

  const balance = Math.max(0, finalTotal - advancePaid);
  const isFullyPaid = advancePaid >= finalTotal;

  const VISIT_TYPE_LABELS: Record<string, string> = {
    new: uiT("New Glasses", "नई चश्मा"),
    frame_change: uiT("Frame Change", "फ्रेम बदलें"),
    new_lens: uiT("New Lens", "नया लेंस"),
    contact_lens: uiT("Contact Lens", "कॉन्टैक्ट लेंस"),
    service: uiT("Service", "सेवा"),
    other: uiT("Other", "अन्य"),
  };

  const summaryCards = [
    {
      title: uiT("Service Details", "सेवा विवरण"),
      color: "blue",
      icon: <Activity size={18} />,
      content: (
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-th-secondary">{uiT("Type", "प्रकार")}</span>
            <span className="text-sm font-bold text-th-text">{VISIT_TYPE_LABELS[visitType] || visitType}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-xs text-th-secondary">{uiT("Date", "तारीख")}</span>
            <span className="text-sm font-medium text-th-text flex items-center gap-1">
              <CalendarDays size={13} className="text-th-secondary" />
              {formatDate(visitDate)}
            </span>
          </div>
          {visitDoctor && (
            <div className="flex justify-between items-start">
              <span className="text-xs text-th-secondary">{uiT("Doctor", "डॉक्टर")}</span>
              <span className="text-sm font-medium text-th-text flex items-center gap-1">
                <User size={13} className="text-th-secondary" />
                {visitDoctor}
              </span>
            </div>
          )}
          {visitRemarks && (
            <div className="pt-2 mt-2 border-t border-[#1f1f1f]">
              <span className="text-[11px] font-semibold text-th-secondary uppercase tracking-wider block mb-1">{uiT("Remarks", "टिप्पणी")}</span>
              <p className="text-sm text-th-text italic">"{visitRemarks}"</p>
            </div>
          )}
        </div>
      ),
    },
    ...(usePrescription ? [{
      title: uiT("Prescription", "प्रिस्क्रिप्शन"),
      color: "violet",
      icon: <Eye size={18} />,
      content: (
        <div className="space-y-3">
          {(() => {
            const hasRight = prescription.rightEye && hasEyeData(prescription.rightEye);
            const hasLeft = prescription.leftEye && hasEyeData(prescription.leftEye);
            if (!hasRight && !hasLeft) return null;
            const rows = ["dv", "nv", "pc"] as const;
            const labels: Record<string, string> = { dv: "Dist", nv: "Near", pc: "Prog" };
            return (
              <div className="border border-[#1f1f1f] rounded-md overflow-hidden">
                <div className="grid grid-cols-3 text-[10px] font-bold text-th-secondary uppercase bg-th-elevated px-3 py-1.5">
                  <span>{uiT("Type", "प्रकार")}</span>
                  <span className="text-center">{uiT("Right", "दायाँ")}</span>
                  <span className="text-center">{uiT("Left", "बायाँ")}</span>
                </div>
                {rows.map((r) => {
                  const rd = prescription.rightEye?.[r];
                  const ld = prescription.leftEye?.[r];
                  if (!rd && !ld) return null;
                  const format = (d: any) => {
                    if (!d) return "—";
                    const parts = [d.sph, d.cyl, d.axis, d.va].filter(Boolean);
                    return parts.length ? parts.join(" ") : "—";
                  };
                  return (
                    <div key={r} className="grid grid-cols-3 text-xs border-t border-[#1f1f1f] px-3 py-1.5">
                      <span className="text-th-secondary font-medium">{labels[r]}</span>
                      <span className="text-center text-th-text font-medium">{format(rd)}</span>
                      <span className="text-center text-th-text font-medium">{format(ld)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {prescription.pd && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-th-secondary">{uiT("Pupillary Dist (PD)", "प्यूपिलरी डिस्ट (PD)")}</span>
              <span className="text-sm font-bold text-th-text">{prescription.pd}</span>
            </div>
          )}
          {prescription.problems && (
            <div>
              <span className="text-[11px] font-semibold text-th-secondary uppercase tracking-wider block mb-0.5">{uiT("Reported Problems", "बताई गई समस्याएँ")}</span>
              <p className="text-sm font-medium text-[#e53935] flex items-start gap-1.5">
                <HeartPulse size={14} className="mt-0.5 flex-shrink-0" />
                {prescription.problems}
              </p>
            </div>
          )}
          {prescription.notes && (
            <div>
              <span className="text-[11px] font-semibold text-th-secondary uppercase tracking-wider block mb-0.5">{uiT("Notes", "नोट्स")}</span>
              <p className="text-sm text-th-text">{prescription.notes}</p>
            </div>
          )}
          {!prescription.pd && !prescription.problems && !prescription.notes && (
            <p className="text-sm text-th-secondary italic text-center py-4">{uiT("No additional details recorded.", "कोई अतिरिक्त विवरण दर्ज नहीं किया गया।")}</p>
          )}
        </div>
      ),
    }] : []),
    ...(orderFrames.length > 0 || orderLenses.length > 0 || orderAccessories.length > 0 ? [{
      title: uiT("Order Items", "ऑर्डर आइटम"),
      color: "amber",
      icon: <Tag size={18} />,
      content: (
        <div className="space-y-3">
          {orderFrames.map((f, i) => (
              <div key={`f-${i}`} className="flex justify-between items-start gap-2">
              <div>
                <span className="text-[10px] font-bold text-[#ff9500] uppercase tracking-wider block">{uiT("Frame", "फ्रेम")}</span>
                <p className="text-sm font-medium text-th-text">{f.brand || uiT("Unknown Brand", "अज्ञात ब्रांड")} {f.model}</p>
                {f.color && <p className="text-xs text-th-secondary">{uiT("Color", "रंग")}: {f.color}</p>}
              </div>
              <span className="text-sm font-bold text-th-text tabular-nums">₹{f.price}</span>
            </div>
          ))}
          {orderLenses.map((l, i) => (
            <div key={`l-${i}`} className="flex justify-between items-start gap-2 pt-2 border-t border-[#1f1f1f]">
              <div>
                <span className="text-[10px] font-bold text-[#ff9500] uppercase tracking-wider block">{uiT("Lens", "लेंस")}</span>
                <p className="text-sm font-medium text-th-text">
                  {l.brand || uiT("Standard", "मानक")} {l.features.join(" + ")}
                </p>
                {l.coating && (
                  <p className="text-xs text-th-secondary flex items-center gap-1 mt-0.5">
                    <Sparkles size={12} /> {l.coating}
                  </p>
                )}
              </div>
              <span className="text-sm font-bold text-th-text tabular-nums">₹{l.price}</span>
            </div>
          ))}
          {orderAccessories.map((a, i) => (
            <div key={`a-${i}`} className="flex justify-between items-start gap-2 pt-2 border-t border-[#1f1f1f]">
              <div>
                <span className="text-[10px] font-bold text-[#ff9500] uppercase tracking-wider block">{uiT("Accessory", "एक्सेसरी")}</span>
                <p className="text-sm font-medium text-th-text">{a.name}</p>
              </div>
              <span className="text-sm font-bold text-th-text tabular-nums">₹{a.price}</span>
            </div>
          ))}
        </div>
      ),
    }] : []),
    {
      title: uiT("Billing & Payment", "बिलिंग और भुगतान"),
      color: "emerald",
      icon: <CreditCard size={18} />,
      content: (
        <div className="space-y-2">
          {billItems.filter(i => i.description && i.price > 0).map((item, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-th-secondary truncate pr-4">
                {item.qty > 1 && <span className="text-th-secondary mr-1">{item.qty}x</span>}
                {item.description}
              </span>
              <span className="font-medium text-th-text tabular-nums shrink-0">₹{(item.price * item.qty).toFixed(0)}</span>
            </div>
          ))}

          <div className="border-t-2 border-dashed border-[#1f1f1f] mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-th-secondary">{uiT("Subtotal", "उप-योग")}</span>
              <span className="font-semibold text-th-text tabular-nums">₹{totalAmount.toLocaleString()}</span>
            </div>
            {discountVal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#e53935]">{uiT("Discount", "छूट")}</span>
                <span className="font-bold text-[#e53935] tabular-nums">-₹{discountVal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base pt-1">
              <span className="font-bold text-th-text">{uiT("Grand Total", "कुल योग")}</span>
              <span className="font-black text-th-text tabular-nums">₹{finalTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-t border-[#1f1f1f] mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#1ed760]">{uiT("Advance Paid", "अग्रिम भुगतान")}</span>
              <span className="font-bold text-[#1ed760] tabular-nums">₹{advancePaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={`font-bold ${isFullyPaid ? "text-[#1ed760]" : "text-[#ff9500]"}`}>
                {isFullyPaid ? uiT("Fully Paid", "पूर्ण भुगतान") : uiT("Balance Due", "शेष देय")}
              </span>
              <span className={`font-black tabular-nums ${isFullyPaid ? "text-[#1ed760]" : "text-[#ff9500]"}`}>
                ₹{balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    ...(deliveryAddress || deliveryDate ? [{
      title: uiT("Delivery Status", "डिलीवरी स्थिति"),
      color: "primary",
      icon: <Truck size={18} />,
      content: (
        <div className="space-y-4">
          {deliveryDate && (
            <div>
              <span className="text-[11px] font-semibold text-th-secondary uppercase tracking-wider block mb-1">{uiT("Expected Delivery", "अपेक्षित डिलीवरी")}</span>
              <p className="text-sm font-bold text-th-text flex items-center gap-2">
                <CalendarDays size={15} className="text-[#1ed760]" />
                {formatDate(deliveryDate)}
              </p>
            </div>
          )}
          {deliveryAddress && (
            <div>
              <span className="text-[11px] font-semibold text-th-secondary uppercase tracking-wider block mb-1">{uiT("Shipping Address", "शिपिंग पता")}</span>
              <p className="text-sm font-medium text-th-text flex items-start gap-2">
                <MapPin size={15} className="text-[#1ed760] mt-0.5 shrink-0" />
                {deliveryAddress}
              </p>
            </div>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 bg-[#1ed760]/10 shadow-[0_0_0_1px_#1ed760] rounded-lg p-4">
        <div className="w-10 h-10 rounded-full bg-[#1ed760] flex items-center justify-center shrink-0">
          <CheckCircle size={20} className="text-black" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1ed760]">{uiT("Ready to Save", "सेव करने के लिए तैयार")}</h2>
          <p className="text-xs font-medium text-[#1ed760]/80">{uiT("Please verify the details below before confirming the visit.", "कृपया यात्रा की पुष्टि करने से पहले नीचे दिए गए विवरण की जाँच करें।")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {summaryCards.map((card, i) => (
          <SummaryCard key={i} color={card.color} icon={card.icon} title={card.title}>
            {card.content}
          </SummaryCard>
        ))}
      </div>
    </motion.div>
  );
}
