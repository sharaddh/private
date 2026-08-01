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
    <nav className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 py-2 lg:py-0">
      {sections.map((s) => {
        const active = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
            className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
              active
                ? "text-[#1ed760]"
                : "text-th-secondary hover:text-th-text hover:bg-th-elevated"
            }`}
          >
            {active && (
              <motion.div
                layoutId="sectionNavHighlight"
                className="absolute inset-0 bg-[#1ed760]/10 rounded-lg border border-[#1ed760]/20"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2.5">
              <span className="shrink-0">{s.icon}</span>
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
