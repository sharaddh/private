import { motion, AnimatePresence } from "framer-motion";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";

interface BranchInfo {
  _id: string;
  name: string;
  code: string;
  dbName: string;
  isActive: boolean;
}

interface SettingsHeaderProps {
  user: Record<string, unknown> | null;
  currentBranch: BranchInfo | null;
  branches: BranchInfo[];
  isStaff: boolean;
  onSwitchBranch: (id: string) => void;
  saved: boolean;
  saving: boolean;
}

export default function SettingsHeader({
  user,
  currentBranch,
  branches,
  isStaff,
  onSwitchBranch,
  saved,
  saving,
}: SettingsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.div
                key="saving"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 rounded-full"
              >
                <Loader2 size={12} className="text-blue-500 animate-spin" />
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Saving</span>
              </motion.div>
            ) : saved ? (
              <motion.div
                key="saved"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full"
              >
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure your application preferences
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!isStaff && branches.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1">
            {branches.map((b) => (
              <button
                key={b._id}
                onClick={() => onSwitchBranch(b._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentBranch?._id === b._id
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Building2 size={14} />
                {b.name}
              </button>
            ))}
          </div>
        )}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0">
          {((user?.name as string) || (user?.username as string) || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  );
}
