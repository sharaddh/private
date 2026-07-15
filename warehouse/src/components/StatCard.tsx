import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  badge?: { text: string; variant: string };
}

export default function StatCard({ icon: Icon, iconColor, iconBg, value, label, badge }: Props) {
  return (
    <div className="glass-card-hover">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
        {badge && <span className={`badge-${badge.variant}`}>{badge.text}</span>}
      </div>
      <p className="stat-value text-th-text">{value}</p>
      <p className="text-caption text-th-secondary">{label}</p>
    </div>
  );
}
