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
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-th-surface/95 backdrop-blur-xl border-b border-th-border shadow-sm mb-6 -mt-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-4xl mx-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-200 ${
              activeSection === s.id
                ? "text-[#1ed760]"
                : "text-th-secondary hover:text-th-text hover:bg-th-elevated"
            }`}
          >
            {activeSection === s.id && (
              <motion.div
                layoutId="sectionNavHighlight"
                className="absolute inset-0 bg-[#1ed760]/10 rounded-lg"
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
