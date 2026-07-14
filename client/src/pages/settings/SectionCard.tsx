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
      className={`group/card bg-th-surface rounded-lg p-6 transition-all duration-300 shadow-lg hover:bg-th-hover ${className}`}
    >
      {(icon || title) && (
        <div className="flex items-center gap-3 mb-6">
          {icon && (
            <div className="w-9 h-9 rounded-full bg-th-elevated flex items-center justify-center text-[#1ed760] shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-th-text">{title}</h3>
            {subtitle && <p className="text-xs text-th-secondary mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.div>
  );
}
