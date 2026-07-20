import { motion } from "framer-motion";
import {
  Eye,
  RefreshCw,
  Maximize2,
  Circle,
  Wrench,
  Grid3X3,
  Calendar,
  User,
  MessageSquare,
  Activity,
  Check,
} from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface Props {
  visitType: string;
  setVisitType: (v: string) => void;
  visitDate: string;
  setVisitDate: (v: string) => void;
  visitDoctor: string;
  setVisitDoctor: (v: string) => void;
  visitRemarks: string;
  setVisitRemarks: (v: string) => void;
}

export default function VisitTypeSection({
  visitType,
  setVisitType,
  visitDate,
  setVisitDate,
  visitDoctor,
  setVisitDoctor,
  visitRemarks,
  setVisitRemarks,
}: Props) {
  const { uiT } = useTranslate();

  const VISIT_TYPES = [
    { value: "new", label: uiT("New Glasses", "नई चश्मा"), description: uiT("Full prescription glasses", "पूर्ण प्रिस्क्रिप्शन चश्मा"), icon: Eye, color: "bg-th-elevated" },
    { value: "frame_change", label: uiT("Frame Change", "फ्रेम बदलें"), description: uiT("Replace existing frame", "मौजूदा फ्रेम बदलें"), icon: RefreshCw, color: "bg-th-elevated" },
    { value: "new_lens", label: uiT("New Lens", "नया लेंस"), description: uiT("Replace existing lens", "मौजूदा लेंस बदलें"), icon: Maximize2, color: "bg-th-elevated" },
    { value: "contact_lens", label: uiT("Contact Lens", "कॉन्टैक्ट लेंस"), description: uiT("Contact lens fitting", "कॉन्टैक्ट लेंस फिटिंग"), icon: Circle, color: "bg-th-elevated" },
    { value: "service", label: uiT("Service", "सेवा"), description: uiT("Repair & adjustments", "मरम्मत और समायोजन"), icon: Wrench, color: "bg-th-elevated" },
    { value: "other", label: uiT("Other", "अन्य"), description: uiT("General visit", "सामान्य यात्रा"), icon: Grid3X3, color: "bg-th-elevated" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 120 }}
      className="space-y-6"
    >
      {/* Visit Type Selection */}
      <section className="bg-th-surface rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
            <Activity size={18} className="text-[#1ed760]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-th-text">{uiT("Visit Type", "यात्रा प्रकार")}</h2>
            <p className="text-xs text-th-secondary">{uiT("Choose the purpose of your visit", "अपनी यात्रा का उद्देश्य चुनें")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VISIT_TYPES.map((vt) => {
            const Icon = vt.icon;
            const selected = visitType === vt.value;

            return (
              <motion.button
                key={vt.value}
                onClick={() => setVisitType(vt.value)}
                whileTap={{ scale: 0.95 }}
                className={`relative overflow-hidden rounded-md p-4 text-left transition-all ${
                  selected
                    ? "bg-th-card shadow-[0_0_0_2px_#1ed760]"
                    : "bg-th-elevated hover:bg-th-card"
                }`}
                aria-pressed={selected}
              >
                <div
                  className={`w-11 h-11 rounded-sm ${vt.color} flex items-center justify-center mb-3`}
                >
                  <Icon size={20} className="text-th-text" />
                </div>
                <div className="text-sm font-semibold text-th-text mb-1">{vt.label}</div>
                <div className="text-[15px] text-th-secondary leading-tight">{vt.description}</div>

                {selected && (
                  <motion.div
                    layoutId="visitTypeCheck"
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#1ed760] flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 18, stiffness: 300 }}
                  >
                    <Check size={14} className="text-th-text" strokeWidth={3} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Visit Details */}
      <section className="bg-th-surface rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
            <Calendar size={18} className="text-[#1ed760]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-th-text">{uiT("Visit Details", "यात्रा विवरण")}</h2>
            <p className="text-xs text-th-secondary">{uiT("Date, doctor, and notes", "तारीख, डॉक्टर, और नोट्स")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Date Input */}
          <div className="relative group">
            <Calendar
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none transition-colors group-focus-within:text-[#1ed760]"
            />
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-th-elevated text-th-text rounded-md text-sm border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>

          {/* Doctor Input */}
          <div className="relative group">
            <User
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none transition-colors group-focus-within:text-[#1ed760]"
            />
            <input
              placeholder={uiT("Doctor name (optional)", "डॉक्टर का नाम (वैकल्पिक)")}
              value={visitDoctor}
              onChange={(e) => setVisitDoctor(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-th-elevated text-th-text rounded-md text-sm placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>

          {/* Remarks Input */}
          <div className="relative group">
            <MessageSquare
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none transition-colors group-focus-within:text-[#1ed760]"
            />
            <input
              placeholder={uiT("Remarks (optional)", "टिप्पणी (वैकल्पिक)")}
              value={visitRemarks}
              onChange={(e) => setVisitRemarks(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-th-elevated text-th-text rounded-md text-sm placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
        </div>
      </section>
    </motion.div>
  );
}
