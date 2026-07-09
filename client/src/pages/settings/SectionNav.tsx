import { motion } from "framer-motion";
import { type ReactNode } from "react";

export interface Section {
  id: string;
  label: string;
  icon: ReactNode;
}

interface SectionNavProps {
  sections: Section[];
  activeSection: string;
  onSectionClick: (id: string) => void;
}

export default function SectionNav({ sections, activeSection, onSectionClick }: SectionNavProps) {
  return (
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700/50 mb-6 -mt-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin max-w-4xl mx-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
              activeSection === s.id
                ? "text-primary-600 dark:text-primary-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
            }`}
          >
            {activeSection === s.id && (
              <motion.div
                layoutId="sectionNavHighlight"
                className="absolute inset-0 bg-primary-50 dark:bg-primary-500/10 rounded-xl"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span className="shrink-0">{s.icon}</span>
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
