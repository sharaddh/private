import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

export default function SectionHeader({ title, action, icon: Icon }: Props) {
  return (
    <div className="card-header">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-th-elevated flex items-center justify-center">
            <Icon size={16} className="text-th-secondary" />
          </div>
        )}
        <h3 className="text-body-bold text-th-text">{title}</h3>
      </div>
      {action}
    </div>
  );
}
