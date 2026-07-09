import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface SectionCardProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}

export default function SectionCard({ icon, title, subtitle, children, className = "", id }: SectionCardProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`group/card bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 ${className}`}
    >
      {(icon || title) && (
        <div className="flex items-center gap-3 mb-6">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.div>
  );
}
