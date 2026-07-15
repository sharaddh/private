import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  color: string;
  onClick: () => void;
}

export default function QuickAction({ icon: Icon, label, color, onClick }: Props) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-between p-4 bg-${color}/10 rounded-md hover:bg-${color}/20 transition-all group`}>
      <div className="flex items-center gap-3">
        <Icon size={18} className={`text-${color}`} />
        <span className={`text-body-bold text-${color}`}>{label}</span>
      </div>
      <ArrowRight size={18} className={`text-${color} group-hover:translate-x-0.5 transition-transform`} />
    </button>
  );
}
