import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTranslate } from "../../context/TranslateContext";

interface ThemeToggleProps {
  dark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  const { uiT } = useTranslate();
  return (
    <div className="flex bg-th-elevated rounded-lg p-1 w-full">
      <button
        type="button"
        onClick={() => { if (dark) onToggle(); }}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
          !dark
            ? "bg-[#1ed760] text-black"
            : "text-th-secondary hover:text-th-text"
        }`}
      >
        {!dark && (
          <motion.div
            layoutId="themeHighlight"
            className="absolute inset-0 bg-[#1ed760] rounded-lg"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Sun size={15} className="relative z-10" />
        <span className="relative z-10">{uiT("Light", "लाइट")}</span>
      </button>
      <button
        type="button"
        onClick={() => { if (!dark) onToggle(); }}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
          dark
            ? "bg-[#1ed760] text-black"
            : "text-th-secondary hover:text-th-text"
        }`}
      >
        {dark && (
          <motion.div
            layoutId="themeHighlight"
                className="absolute inset-0 bg-[#1ed760] rounded-lg"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Moon size={15} className="relative z-10" />
        <span className="relative z-10">{uiT("Dark", "डार्क")}</span>
      </button>
    </div>
  );
}
