import { motion } from "framer-motion";
import { Eye, Ruler, AlertTriangle, FileText } from "lucide-react";

const FIELDS = ["sph", "cyl", "axis", "va"];

function EyeRow({ 
  label, 
  data, 
  onChange 
}: { 
  label: string; 
  data: any; 
  onChange: (v: any) => void; 
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 sm:items-center">
      {/* Row Label */}
      <div className="w-full sm:w-[100px] shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-4 gap-2 w-full flex-1">
        {FIELDS.map((f) => (
          <div key={f} className="flex flex-col gap-1">
            {/* Mobile-only micro labels (hidden on desktop to use the main table header) */}
            <span className="sm:hidden text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase text-center mt-1">
              {f}
            </span>
            <input
              placeholder="-"
              value={data?.[f] || ""}
              onChange={(e) => onChange({ ...data, [f]: e.target.value })}
              className="w-full text-center py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all shadow-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable Desktop Header for the Columns
function EyeTableHeader() {
  return (
    <div className="hidden sm:flex gap-4 items-center mb-3">
      <div className="w-[100px] shrink-0"></div>
      <div className="grid grid-cols-4 gap-2 w-full flex-1">
        {FIELDS.map((f) => (
          <div key={f} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Prescription {
  rightEye: { dv: any; nv: any; pc: any };
  leftEye: { dv: any; nv: any; pc: any };
  pd: string;
  notes: string;
  problems: string;
}

interface Props {
  prescription: Prescription;
  setPrescription: (p: Prescription | ((prev: Prescription) => Prescription)) => void;
}

export default function PrescriptionPanel({ prescription, setPrescription }: Props) {
  function setRight(k: string, v: any) {
    setPrescription((p) => ({ ...p, rightEye: { ...p.rightEye, [k]: v } }));
  }
  function setLeft(k: string, v: any) {
    setPrescription((p) => ({ ...p, leftEye: { ...p.leftEye, [k]: v } }));
  }

  const ROW_KEYS = [
    { key: "dv", label: "Dist Vision" },
    { key: "nv", label: "Near / ADD" },
    { key: "pc", label: "Prog Corridor" }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        
        {/* Right Eye (OD) Panel */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Eye size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Right Eye (O.D.)</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Oculus Dexter</p>
            </div>
          </div>
          
          <EyeTableHeader />
          
          <div className="space-y-4 sm:space-y-3">
            {ROW_KEYS.map(({ key, label }) => (
              <EyeRow 
                key={key}
                label={label}
                data={prescription.rightEye[key]}
                onChange={(v) => setRight(key, v)}
              />
            ))}
          </div>
        </div>

        {/* Left Eye (OS) Panel */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <Eye size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Left Eye (O.S.)</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Oculus Sinister</p>
            </div>
          </div>
          
          <EyeTableHeader />
          
          <div className="space-y-4 sm:space-y-3">
            {ROW_KEYS.map(({ key, label }) => (
              <EyeRow 
                key={key}
                label={label}
                data={prescription.leftEye[key]}
                onChange={(v) => setLeft(key, v)}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Additional Details Panel */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Ruler size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Pupillary Distance (mm)" 
              value={prescription.pd}
              onChange={(e) => setPrescription((p) => ({ ...p, pd: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" 
            />
          </div>
          <div className="relative">
            <AlertTriangle size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Problems (e.g. headaches)" 
              value={prescription.problems}
              onChange={(e) => setPrescription((p) => ({ ...p, problems: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" 
            />
          </div>
          <div className="relative">
            <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Additional notes" 
              value={prescription.notes}
              onChange={(e) => setPrescription((p) => ({ ...p, notes: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all" 
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}