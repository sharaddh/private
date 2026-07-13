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
    <div className="flex bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 w-full">
      <button
        type="button"
        onClick={() => { if (dark) onToggle(); }}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
          !dark
            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        {!dark && (
          <motion.div
            layoutId="themeHighlight"
            className="absolute inset-0 bg-white dark:bg-slate-600 rounded-lg shadow-sm"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Sun size={15} className="relative z-10" />
        <span className="relative z-10">{uiT("Light", "लाइट")}</span>
      </button>
      <button
        type="button"
        onClick={() => { if (!dark) onToggle(); }}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
          dark
            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        {dark && (
          <motion.div
            layoutId="themeHighlight"
            className="absolute inset-0 bg-white dark:bg-slate-600 rounded-lg shadow-sm"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Moon size={15} className="relative z-10" />
        <span className="relative z-10">{uiT("Dark", "डार्क")}</span>
      </button>
    </div>
  );
}
