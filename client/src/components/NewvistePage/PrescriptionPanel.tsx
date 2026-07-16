import { motion } from "framer-motion";
import { Eye, Ruler, AlertTriangle, FileText } from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

const FIELDS = ["sph", "cyl", "axis", "va"];

function EyeRow({
  label,
  data,
  onChange,
  onEdit
}: {
  label: string;
  data: any;
  onChange: (v: any) => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 sm:items-center">
      {/* Row Label */}
      <div className="w-full sm:w-[100px] shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-th-secondary">
          {label}
        </span>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-4 gap-2 w-full flex-1">
        {FIELDS.map((f) => (
          <div key={f} className="flex flex-col gap-1">
            <span className="sm:hidden text-[9px] font-semibold text-th-secondary uppercase text-center mt-1">
              {f}
            </span>
            <input
              placeholder="-"
              value={data?.[f] || ""}
              onChange={(e) => { onEdit?.(); onChange({ ...data, [f]: e.target.value }); }}
              className="w-full text-center py-2 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EyeTableHeader() {
  return (
    <div className="hidden sm:flex gap-4 items-center mb-3">
      <div className="w-[100px] shrink-0"></div>
      <div className="grid grid-cols-4 gap-2 w-full flex-1">
        {FIELDS.map((f) => (
          <div key={f} className="text-center text-[10px] font-bold text-th-secondary uppercase tracking-wider">
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
  usePrescription?: boolean;
  setUsePrescription?: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function PrescriptionPanel({ prescription, setPrescription, usePrescription, setUsePrescription }: Props) {
  const { uiT } = useTranslate();

  function autoEnable() {
    if (!usePrescription && setUsePrescription) setUsePrescription(true);
  }

  function setRight(k: string, v: any) {
    setPrescription((p) => ({ ...p, rightEye: { ...p.rightEye, [k]: v } }));
  }
  function setLeft(k: string, v: any) {
    setPrescription((p) => ({ ...p, leftEye: { ...p.leftEye, [k]: v } }));
  }

  const ROW_KEYS = [
    { key: "dv", label: uiT("Dist Vision", "दूर दृष्टि") },
    { key: "nv", label: uiT("Near / ADD", "निकट / ADD") },
    { key: "pc", label: uiT("Prog Corridor", "प्रोग कॉरिडोर") },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Right Eye (OD) Panel */}
        <div className="bg-th-surface rounded-lg shadow-lg p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
              <Eye size={18} className="text-[#1ed760]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-th-text">{uiT("Right Eye (O.D.)", "दायाँ आँख (O.D.)")}</h3>
              <p className="text-[11px] text-th-secondary">Oculus Dexter</p>
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
                onEdit={autoEnable}
              />
            ))}
          </div>
        </div>

        {/* Left Eye (OS) Panel */}
        <div className="bg-th-surface rounded-lg shadow-lg p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-sm bg-[#1ed760]/10 flex items-center justify-center">
              <Eye size={18} className="text-[#1ed760]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-th-text">{uiT("Left Eye (O.S.)", "बायाँ आँख (O.S.)")}</h3>
              <p className="text-[11px] text-th-secondary">Oculus Sinister</p>
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
                onEdit={autoEnable}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Additional Details Panel */}
      <div className="bg-th-surface rounded-lg shadow-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Ruler size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
            <input
              placeholder={uiT("Pupillary Distance (mm)", "प्यूपिलरी दूरी (mm)")}
              value={prescription.pd}
              onChange={(e) => { autoEnable(); setPrescription((p) => ({ ...p, pd: e.target.value })); }}
              className="w-full pl-10 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
          <div className="relative">
            <AlertTriangle size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
            <input
              placeholder={uiT("Problems (e.g. headaches)", "समस्याएँ (जैसे सिरदर्द)")}
              value={prescription.problems}
              onChange={(e) => { autoEnable(); setPrescription((p) => ({ ...p, problems: e.target.value })); }}
              className="w-full pl-10 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
          <div className="relative">
            <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
            <input
              placeholder={uiT("Additional notes", "अतिरिक्त नोट्स")}
              value={prescription.notes}
              onChange={(e) => { autoEnable(); setPrescription((p) => ({ ...p, notes: e.target.value })); }}
              className="w-full pl-10 pr-4 py-2.5 bg-th-elevated text-th-text rounded-md text-sm font-medium placeholder-th-secondary border border-th-border focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
