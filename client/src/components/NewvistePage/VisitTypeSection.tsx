import { motion } from "motion/react";
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

const VISIT_TYPES = [
  { value: "new", label: "New Glasses", description: "Full prescription glasses", icon: Eye, color: "from-blue-500 to-blue-600" },
  { value: "frame_change", label: "Frame Change", description: "Replace existing frame", icon: RefreshCw, color: "from-violet-500 to-violet-600" },
  { value: "new_lens", label: "New Lens", description: "Replace existing lens", icon: Maximize2, color: "from-emerald-500 to-emerald-600" },
  { value: "contact_lens", label: "Contact Lens", description: "Contact lens fitting", icon: Circle, color: "from-amber-500 to-amber-600" },
  { value: "service", label: "Service", description: "Repair & adjustments", icon: Wrench, color: "from-rose-500 to-rose-600" },
  { value: "other", label: "Other", description: "General visit", icon: Grid3X3, color: "from-slate-500 to-slate-600" },
];

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 120 }}
      className="space-y-6"
    >
      {/* Visit Type Selection */}
      <section className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
            <Activity size={18} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Visit Type</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Choose the purpose of your visit</p>
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
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all border-2 ${
                  selected
                    ? "border-primary-400 dark:border-primary-500 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-500/15 dark:to-blue-500/10 shadow-md shadow-primary-500/15"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                }`}
                aria-pressed={selected}
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${vt.color} flex items-center justify-center mb-3 shadow-sm`}
                >
                  <Icon size={20} className="text-white" />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{vt.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{vt.description}</div>

                {selected && (
                  <motion.div
                    layoutId="visitTypeCheck"
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center shadow-sm"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 18, stiffness: 300 }}
                  >
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Visit Details */}
      <section className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
            <Calendar size={18} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Visit Details</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Date, doctor, and notes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Date Input */}
          <div className="relative group">
            <Calendar
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-focus-within:text-primary-500"
            />
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Doctor Input */}
          <div className="relative group">
            <User
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-focus-within:text-primary-500"
            />
            <input
              placeholder="Doctor name (optional)"
              value={visitDoctor}
              onChange={(e) => setVisitDoctor(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Remarks Input */}
          <div className="relative group">
            <MessageSquare
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-focus-within:text-primary-500"
            />
            <input
              placeholder="Remarks (optional)"
              value={visitRemarks}
              onChange={(e) => setVisitRemarks(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 transition-all"
            />
          </div>
        </div>
      </section>
    </motion.div>
  );
}   