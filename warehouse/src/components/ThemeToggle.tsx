import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { dark, toggle } = useTheme();

  return (
    <button onClick={toggle}
      className="flex items-center gap-3 px-3 py-2.5 rounded-pill text-th-secondary hover:text-th-text hover:bg-th-hover w-full transition-all text-nav">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
    </button>
  );
}
