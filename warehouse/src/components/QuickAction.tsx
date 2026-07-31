import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type ActionColor = "primary-500" | "announcement" | "emerald-500" | "amber-500" | "purple-500" | "negative" | "cyan-500";

const COLOR_STYLES: Record<ActionColor, { bg: string; text: string; hover: string }> = {
  "primary-500": { bg: "bg-primary-500/10", text: "text-primary-500", hover: "hover:bg-primary-500/20" },
  "announcement": { bg: "bg-announcement/10", text: "text-announcement", hover: "hover:bg-announcement/20" },
  "emerald-500": { bg: "bg-emerald-500/10", text: "text-emerald-500", hover: "hover:bg-emerald-500/20" },
  "amber-500": { bg: "bg-amber-500/10", text: "text-amber-500", hover: "hover:bg-amber-500/20" },
  "purple-500": { bg: "bg-purple-500/10", text: "text-purple-500", hover: "hover:bg-purple-500/20" },
  "negative": { bg: "bg-negative/10", text: "text-negative", hover: "hover:bg-negative/20" },
  "cyan-500": { bg: "bg-cyan-500/10", text: "text-cyan-500", hover: "hover:bg-cyan-500/20" },
};

interface Props {
  icon: LucideIcon;
  label: string;
  color: ActionColor;
  onClick: () => void;
}

export default function QuickAction({ icon: Icon, label, color, onClick }: Props) {
  const style = COLOR_STYLES[color] || COLOR_STYLES["primary-500"];
  return (
    <button onClick={onClick}
      className={`flex items-center justify-between gap-2 p-3 sm:p-4 ${style.bg} ${style.hover} rounded-md transition-all group min-w-0`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Icon size={18} className={`${style.text} shrink-0`} />
        <span className={`text-caption sm:text-body-bold ${style.text} truncate`}>{label}</span>
      </div>
      <ArrowRight size={18} className={`${style.text} shrink-0 group-hover:translate-x-0.5 transition-transform`} />
    </button>
  );
}
